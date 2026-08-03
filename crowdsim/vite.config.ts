import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const maplibreWorkers = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"].map((name) => ({
  fileName: `assets/${name}`,
  source: readFileSync(new URL(`./node_modules/maplibre-gl/dist/${name}`, import.meta.url), "utf8")
    .replace(/\n\/\/# sourceMappingURL=.*$/u, ""),
}));

function offlineServiceWorker(files: string[]) {
  const precache = [
    "/crowdsim/",
    "/crowdsim/data/golden-gate-park.geojson",
    "/crowdsim/tiles/outside-lands.pmtiles",
    ...files.map((file) => `/crowdsim/${file}`),
  ];
  return `const CACHE = "crowdsim-v4";
const PRECACHE = ${JSON.stringify(precache.sort())};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key.startsWith("crowdsim-")).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put("/crowdsim/", response.clone()));
      return response;
    }).catch(() => caches.match("/crowdsim/")));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
`;
}

export default defineConfig({
  base: "/crowdsim/",
  plugins: [{
    name: "crowdsim-offline-shell",
    generateBundle(_options, bundle) {
      for (const worker of maplibreWorkers) this.emitFile({ type: "asset", ...worker });
      const files = [...Object.keys(bundle).filter((file) => file !== "sw.js"), ...maplibreWorkers.map(({ fileName }) => fileName)];
      this.emitFile({ type: "asset", fileName: "sw.js", source: offlineServiceWorker(files) });
    },
  }],
  build: {
    outDir: "../public/crowdsim",
    emptyOutDir: true,
    sourcemap: false,
  },
});
