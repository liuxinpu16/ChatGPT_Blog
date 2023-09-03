import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import OpenAI from "openai";
import clientPromise from "../../lib/mongodb";

export default withApiAuthRequired(async function handler(req, res) {
  const { user } = await getSession(req, res);
  const client = await clientPromise;
  const db = await client.db("ChatGPT_Blog");
  const userProfile = await db
    .collection("users")
    .findOne({ auth0Id: user.sub });

  if (!userProfile?.availableTokens) {
    res.status(403);
    return;
  }
  const { topic, keywords } = req.body;
  if (!topic || !keywords) {
    res.status(422);
    return;
  }

  if (topic.length > 80 || keywords.length > 80) {
    res.status(422);
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const postContentResult = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a blog generator" },
      {
        role: "user",
        content: `Write a long and detailed SEO-friendly blog post about ${topic}, that targets the following comma-separated keywords: ${keywords}.
        The response should be formatted in SEO-friendly HTML tags, you should only use the following HTML tags: p, h1, h2, h3, h4, h5, h6, strong, i ,ul, li, ol.`,
      },
    ],
    temperature: 0.3,
  });

  const postContent = postContentResult.choices[0]?.message.content;

  const titleContentResult = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a blog generator" },
      {
        role: "user",
        content: `Write a long and detailed SEO-friendly blog post about ${topic}, that targets the following comma-separated keywords: ${keywords}.
        The response should be formatted in SEO-friendly HTML, limited to the following HTML tags: p, h1, h2, h3, h4, h5, h6, strong, i ,ul, li, ol.`,
      },
      { role: "assistant", content: postContent },
      {
        role: "user",
        content:
          "Generate an appropriate title for the above blog post, only return the title, no html tags attached",
      },
    ],
    temperature: 0.3,
  });

  const metaContentResult = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a blog generator" },
      {
        role: "user",
        content: `Write a long and detailed SEO-friendly blog post about ${topic}, that targets the following comma-separated keywords: ${keywords}.
        The response should be formatted in SEO-friendly HTML, limited to the following HTML tags: p, h1, h2, h3, h4, h5, h6, strong, i ,ul, li, ol.`,
      },
      { role: "assistant", content: postContent },
      {
        role: "user",
        content:
          "Generate SEO-friendly meta description for the above blog post, only return the description, no html tags attached",
      },
    ],
    temperature: 0.3,
  });

  await db
    .collection("users")
    .updateOne({ auth0Id: user.sub }, { $inc: { availableTokens: -1 } });

  const title = titleContentResult.choices[0]?.message.content;
  const meta = metaContentResult.choices[0]?.message.content;

  const post = await db.collection("posts").insertOne({
    postContent: postContent || "",
    title: title || "",
    metaDescription: meta || "",
    topic,
    keywords,
    userId: userProfile._id,
    created: new Date(),
  });

  res.status(200).json({ postId: post.insertedId });
});
