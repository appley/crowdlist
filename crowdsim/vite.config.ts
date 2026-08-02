import { defineConfig } from "vite";

export default defineConfig({
  base: "/crowdsim/",
  build: {
    outDir: "../public/crowdsim",
    emptyOutDir: true,
    sourcemap: false,
  },
});
