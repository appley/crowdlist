import Head from "next/head";
import dynamic from "next/dynamic";

const ClientApp = dynamic(() => import("../src/ClientApp"), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>CrowdList — The Outside Lands map, alive</title>
        <meta
          name="description"
          content="CrowdList turns the official Outside Lands map into a live view of crowd comfort and festival energy."
        />
        <meta name="theme-color" content="#153b2b" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="preconnect" href="https://api.data.jambase.com" />
      </Head>
      <ClientApp />
    </>
  );
}
