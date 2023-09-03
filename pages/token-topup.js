import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import AppLayout from "../components/AppLayout/AppLayout";
import { getAppProps } from "../utils/getAppProps";

export default function TokenTopup() {
  const handleClick = async () => {
    const res = await fetch("/api/addTokens");
    const data = await res.json();
    window.location.href = data.session.url;
    console.log(data);
  };

  return (
    <div className="flex h-full  w-full flex-col justify-center items-center ">
      <h1>Run out of token?</h1>
      <button onClick={handleClick} className="btn">
        Add token
      </button>
    </div>
  );
}

TokenTopup.getLayout = function getLayout(page, pageProps) {
  return <AppLayout {...pageProps}>{page}</AppLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    const props = await getAppProps(ctx);
    return { props };
  },
});
