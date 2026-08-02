/// <reference types="vite/client" />

declare module "*.geojson?raw" {
  const value: string;
  export default value;
}
