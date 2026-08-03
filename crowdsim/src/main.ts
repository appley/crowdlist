import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import * as maplibregl from "maplibre-gl";
import { FileSource, PMTiles, Protocol } from "pmtiles";
import { DEFAULT_CONFIG, type FestivalDay, type SimulationConfig, type Stage } from "./data/schema";
import { downloadJson, downloadNdjson } from "./data/export";
import { validateDay } from "./data/loader";
import { attachDeck, renderLayers } from "./render/deck";
import { flyToView } from "./render/camera";
import type { RenderBucket } from "./render/layers/densityBlanket";
import { createHud } from "./ui/hud";
import { createInspector } from "./ui/inspector";
import { createLegend } from "./ui/legend";
import { createTimeline } from "./ui/timeline";

const root = document.querySelector<HTMLElement>("#app")!;
root.innerHTML = `<main class="sim-shell"><header class="topbar"><a class="wordmark" href="/" aria-label="Back to CrowdList"><span>CL</span><strong>CrowdSim</strong></a><div class="source-badge" data-source>SIMULATED · ESTIMATE</div><div class="run-stats" data-stats>Preparing a deterministic festival day…</div><button class="utility-button" data-import>Load JSON</button><input hidden type="file" accept="application/json" data-file/><button class="utility-button" data-export>FestivalDay JSON</button><button class="utility-button" data-ndjson>NDJSON pings</button></header><section class="map-stage"><div id="map"></div><div id="deck"></div><div class="loading" data-loading><span></span><h1>Precomputing the day</h1><p>8,000 agents · 10 hours · 60-second H3 frames</p></div><div class="view-controls"><button data-view="overhead">Overhead</button><button data-view="oblique" class="active">Oblique</button><button data-view="stage">Stage close-up</button><button data-debug>Path graph</button></div><section class="config-panel"><p class="micro-label">RE-ROLL THE PORTRAIT</p><label>Seed<input data-seed type="number" value="42" min="1" max="4294967295"/></label><label>Agents<input data-agents type="number" value="8000" min="100" max="50000" step="100"/></label><button data-run>Run simulation</button><small>Same seed + config = byte-identical FestivalDay.</small></section><div class="attribution">© OpenStreetMap contributors · Basemap: Protomaps · Stage positions: authored estimates</div></section><div data-timeline></div></main>`;

const protocol = new Protocol();
const tileResponse = await fetch("/crowdsim/tiles/outside-lands.pmtiles");
if (!tileResponse.ok) throw new Error("Offline basemap archive is unavailable");
const tileFile = new File([await tileResponse.blob()], "outside-lands");
protocol.add(new PMTiles(new FileSource(tileFile)));
maplibregl.addProtocol("pmtiles", protocol.tile);
const map = new maplibregl.Map({
  container: "map", center: [-122.492, 37.769], zoom: 14.55, pitch: 56, bearing: -22, attributionControl: false,
  style: { version: 8, sources: { protomaps: { type: "vector", url: "pmtiles://outside-lands" } }, layers: [
    { id: "background", type: "background", paint: { "background-color": "#101313" } },
    { id: "earth", type: "fill", source: "protomaps", "source-layer": "earth", paint: { "fill-color": "#242b27" } },
    { id: "water", type: "fill", source: "protomaps", "source-layer": "water", paint: { "fill-color": "#152427" } },
    { id: "landuse", type: "fill", source: "protomaps", "source-layer": "landuse", paint: { "fill-color": "#2d382f", "fill-opacity": 0.82 } },
    { id: "roads", type: "line", source: "protomaps", "source-layer": "roads", paint: { "line-color": "#7d8780", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 2.8], "line-opacity": 0.82 } },
    { id: "buildings", type: "fill", source: "protomaps", "source-layer": "buildings", paint: { "fill-color": "#464e48", "fill-opacity": 0.88 } },
  ] },
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

let day: FestivalDay | null = null; let overlay: ReturnType<typeof attachDeck> | null = null;
let time = Date.parse(DEFAULT_CONFIG.startTime); let playing = false; let speed = 15; let previousFrame = performance.now();
let selectedStage: Stage | null = null; let selectedH3: string | null = null; let debugGraph = false;
let timeline: ReturnType<typeof createTimeline> | null = null; let hud: ReturnType<typeof createHud> | null = null;
const inspector = createInspector(); document.querySelector(".map-stage")!.append(inspector.element); document.querySelector(".map-stage")!.append(createLegend());

overlay = attachDeck(map);
run(DEFAULT_CONFIG);

function run(config: SimulationConfig) {
  document.querySelector<HTMLElement>("[data-loading]")!.hidden = false;
  const worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<{ day?: FestivalDay; durationMs?: number; error?: string }>) => {
    worker.terminate();
    if (!event.data.day) { document.querySelector<HTMLElement>("[data-loading]")!.innerHTML = `<h1>Simulation stopped</h1><p>${event.data.error || "Unknown error"}</p>`; return; }
    installDay(event.data.day, event.data.durationMs || 0);
  };
  worker.postMessage(config);
}

function installDay(nextDay: FestivalDay, durationMs: number) {
  day = validateDay(nextDay); time = Date.parse(DEFAULT_CONFIG.startTime); selectedStage = day.site.stages[0]; selectedH3 = null;
  document.querySelector<HTMLElement>("[data-loading]")!.hidden = true;
  document.querySelector<HTMLElement>("[data-source]")!.textContent = `${day.meta.source.toUpperCase()} · ${day.meta.source === "simulated" ? "ESTIMATE, NOT MEASUREMENT" : "DATA PORTRAIT"}`;
  document.querySelector<HTMLElement>("[data-source]")!.className = `source-badge ${day.meta.source}`;
  const bytes = new Blob([JSON.stringify(day)]).size;
  document.querySelector<HTMLElement>("[data-stats]")!.textContent = `${(durationMs / 1000).toFixed(1)}s compute · ${day.density.length.toLocaleString()} buckets · ${(bytes / 1_000_000).toFixed(1)} MB`;
  document.querySelector("[data-timeline]")!.replaceChildren();
  timeline = createTimeline(day, (value) => { time = value; playing = false; draw(); }, () => { playing = !playing; draw(); }, (value) => { speed = value; draw(); }, (event) => { time = event.t; playing = false; draw(); });
  document.querySelector("[data-timeline]")!.append(timeline.element);
  hud?.element.remove(); hud = createHud(day); document.querySelector(".map-stage")!.append(hud.element);
  draw();
}

function draw() {
  if (!day || !overlay) return;
  renderLayers(overlay, day, { time, selectedH3, selectedStage: selectedStage?.id || null, debugGraph,
    onBucket: (bucket: RenderBucket) => { selectedH3 = bucket.h3; selectedStage = null; inspector.showBucket(bucket, time); draw(); },
    onStage: (stage) => { selectedStage = stage; selectedH3 = null; inspector.showStage(stage, time, day!); draw(); },
  });
  timeline?.update(time, playing, speed); hud?.update(time);
}

function animate(now: number) {
  if (playing && day) {
    time += (now - previousFrame) * speed;
    const end = Date.parse(DEFAULT_CONFIG.endTime);
    if (time >= end) { time = end; playing = false; }
    draw();
  }
  previousFrame = now; requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

document.querySelector("[data-run]")!.addEventListener("click", () => run({ ...DEFAULT_CONFIG, seed: Number((document.querySelector("[data-seed]") as HTMLInputElement).value), agentCount: Number((document.querySelector("[data-agents]") as HTMLInputElement).value) }));
document.querySelector("[data-export]")!.addEventListener("click", () => day && downloadJson(day));
document.querySelector("[data-ndjson]")!.addEventListener("click", () => day && downloadNdjson(day));
document.querySelector("[data-import]")!.addEventListener("click", () => (document.querySelector("[data-file]") as HTMLInputElement).click());
document.querySelector("[data-file]")!.addEventListener("change", async (event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) installDay(validateDay(JSON.parse(await file.text())), 0); });
document.querySelectorAll<HTMLElement>("[data-view]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active")); button.classList.add("active"); flyToView(map, button.dataset.view as "overhead" | "oblique" | "stage", selectedStage || undefined); }));
document.querySelector("[data-debug]")!.addEventListener("click", async (event) => {
  debugGraph = !debugGraph;
  (event.currentTarget as HTMLElement).classList.toggle("active", debugGraph);
  draw();
});
window.addEventListener("keydown", (event) => {
  if ((event.target as HTMLElement).matches("input, select")) return;
  if (event.code === "Space") { event.preventDefault(); playing = !playing; draw(); }
  if (event.key === "ArrowLeft") { time = Math.max(Date.parse(DEFAULT_CONFIG.startTime), time - 60_000); playing = false; draw(); }
  if (event.key === "ArrowRight") { time = Math.min(Date.parse(DEFAULT_CONFIG.endTime), time + 60_000); playing = false; draw(); }
  const speeds = [0.5, 1, 5, 15, 30, 60]; const index = speeds.indexOf(speed);
  if (event.key === "[") { speed = speeds[Math.max(0, index - 1)]; draw(); }
  if (event.key === "]") { speed = speeds[Math.min(speeds.length - 1, index + 1)]; draw(); }
});
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/crowdsim/sw.js", { scope: "/crowdsim/" })
    .then(() => navigator.serviceWorker.ready)
    .then((registration) => console.info("CrowdSim offline cache ready", {
      active: registration.active?.state,
      controlled: Boolean(navigator.serviceWorker.controller),
    }))
    .catch((error) => console.error("CrowdSim offline cache failed", error));
}
