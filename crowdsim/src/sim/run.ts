import type { FestivalDay, FestivalEvent, FestivalSite, SimulationConfig } from "../data/schema";
import { createAgents } from "./agents";
import { aggregateDensity } from "./density";
import { buildRoutes, chooseTargets, moveAgents } from "./movement";
import { SeededRng } from "./rng";
import { buildSchedule } from "./schedule";

export function runSimulation(config: SimulationConfig, site: FestivalSite): FestivalDay {
  const start = Date.parse(config.startTime); const end = Date.parse(config.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Simulation time range is invalid");
  if (config.agentCount < 1 || config.agentCount > 50_000) throw new Error("Agent count must be between 1 and 50,000");
  const sets = buildSchedule(site, start, end);
  const agents = createAgents(config.agentCount, sets, start, end, config.seed, [site.bbox[0] + 0.001, site.bbox[1] + 0.006]);
  const routes = buildRoutes(site); const rng = new SeededRng(config.seed ^ 0xa5a5a5a5);
  const density: FestivalDay["density"] = []; const events: FestivalEvent[] = [];
  const stageCounts = new Uint32Array(site.stages.length);
  const boundaryTimes = new Set(sets.flatMap((set) => [set.startsAt, set.endsAt]));
  for (const set of sets) {
    events.push({ t: set.startsAt, kind: "set_start", stageId: set.stageId, label: `${set.artistName} starts` });
    events.push({ t: set.endsAt, kind: "set_end", stageId: set.stageId, label: `${set.artistName} ends` });
  }
  let lastDecision = start - 10 * 60_000;
  for (let t = start; t <= end; t += config.densityIntervalSeconds * 1000) {
    const atBoundary = boundaryTimes.has(t);
    const nearBoundary = [...boundaryTimes].some((boundary) => Math.abs(boundary - t) <= config.densityIntervalSeconds * 1000);
    if (nearBoundary || t - lastDecision >= 15 * 60_000) {
      const changed = chooseTargets(agents, site, sets, t, stageCounts, rng);
      if (atBoundary && changed > config.agentCount * 0.16) events.push({ t, kind: "mass_migration", label: `${changed.toLocaleString()} people change stages`, magnitude: Math.min(1, changed / config.agentCount) });
      lastDecision = t;
    }
    stageCounts.set(moveAgents(agents, site, routes, t, config.densityIntervalSeconds, config.seed));
    density.push(...aggregateDensity(agents, t, site.h3Resolution, config.kAnonymity));
  }
  for (let stageIndex = 0; stageIndex < site.stages.length; stageIndex += 1) {
    let peak = { t: start, n: 0 };
    for (const bucket of density) {
      const stage = site.stages[stageIndex];
      const [lat, lng] = (awaitCellCenter(bucket.h3));
      if (Math.hypot((lng - stage.lng) * 87_700, (lat - stage.lat) * 110_540) < 180 && bucket.n > peak.n) peak = { t: bucket.t, n: bucket.n };
    }
    events.push({ t: peak.t, kind: "density_peak", stageId: site.stages[stageIndex].id, label: `${site.stages[stageIndex].name} density peak`, magnitude: Math.min(1, peak.n / 300) });
  }
  events.sort((a, b) => a.t - b.t || a.kind.localeCompare(b.kind));
  return { site, sets, density, events, meta: { source: "simulated", seed: config.seed, generatedAt: start, agentCount: config.agentCount } };
}

// Kept isolated so the core loop can be profiled without allocating renderer data.
import { cellToLatLng } from "h3-js";
function awaitCellCenter(h3: string): [number, number] { return cellToLatLng(h3); }
