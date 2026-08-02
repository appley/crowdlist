import { latLngToCell } from "h3-js";
import type { DensityBucket } from "../data/schema";
import type { AgentPopulation } from "./agents";

export function aggregateDensity(population: AgentPopulation, t: number, resolution: number, kAnonymity: number): DensityBucket[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < population.count; i += 1) {
    if (t < population.arrival[i] || t >= population.departure[i] || population.targetStage[i] < 0) continue;
    const h3 = latLngToCell(population.lat[i], population.lng[i], resolution);
    counts.set(h3, (counts.get(h3) || 0) + 1);
  }
  const bucketTime = Math.floor(t / 60_000) * 60_000;
  return [...counts.entries()].filter(([, n]) => n >= kAnonymity).sort(([a], [b]) => a.localeCompare(b)).map(([h3, n]) => ({
    h3, t: bucketTime, n, confidence: Number((1 - Math.exp(-(n - kAnonymity + 1) / 18)).toFixed(6)),
  }));
}
