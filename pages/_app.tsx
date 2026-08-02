import type { AppProps } from "next/app";
import "maplibre-gl/dist/maplibre-gl.css";
import "../src/styles.css";

export default function CrowdListSite({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
