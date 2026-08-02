import { loadFestivalDay } from "./data/loader";
import type { SimulationConfig } from "./data/schema";

self.onmessage = async (event: MessageEvent<SimulationConfig>) => {
  const started = performance.now();
  try {
    const day = await loadFestivalDay(event.data);
    self.postMessage({ day, durationMs: performance.now() - started });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Simulation failed" });
  }
};
