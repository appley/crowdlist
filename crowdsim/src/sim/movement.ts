import { createNoise2D } from "simplex-noise";
import type { FestivalSite, Set } from "../data/schema";
import type { AgentPopulation } from "./agents";
import { preferenceFor } from "./agents";
import { SeededRng } from "./rng";
import { currentSet } from "./schedule";

type Coordinate = [lng: number, lat: number];
export type RouteTable = Coordinate[][][];

const meters = (a: Coordinate, b: Coordinate) => {
  const lat = (a[1] + b[1]) * Math.PI / 360;
  return Math.hypot((b[0] - a[0]) * 111_320 * Math.cos(lat), (b[1] - a[1]) * 110_540);
};

export function buildRoutes(site: FestivalSite): RouteTable {
  const nodeById = new Map(site.pathGraph.nodes.map((node) => [node.id, node]));
  const graph = new Map<string, { id: string; cost: number }[]>();
  for (const edge of site.pathGraph.edges) {
    const a = nodeById.get(edge.from)!; const b = nodeById.get(edge.to)!;
    const cost = meters([a.lng, a.lat], [b.lng, b.lat]) / Math.max(1, edge.widthM);
    graph.set(edge.from, [...(graph.get(edge.from) || []), { id: edge.to, cost }]);
    graph.set(edge.to, [...(graph.get(edge.to) || []), { id: edge.from, cost }]);
  }
  const nearest = site.stages.map((stage) => site.pathGraph.nodes.reduce((best, node) => {
    const distance = meters([stage.lng, stage.lat], [node.lng, node.lat]);
    return distance < best.distance ? { id: node.id, distance } : best;
  }, { id: site.pathGraph.nodes[0].id, distance: Number.POSITIVE_INFINITY }).id);
  const route = (from: number, to: number): Coordinate[] => {
    if (from === to) return [[site.stages[to].lng, site.stages[to].lat]];
    const start = nearest[from]; const goal = nearest[to];
    const costs = new Map<string, number>([[start, 0]]); const previous = new Map<string, string>();
    const heap: { id: string; priority: number }[] = [{ id: start, priority: 0 }];
    const push = (entry: { id: string; priority: number }) => {
      heap.push(entry); let index = heap.length - 1;
      while (index > 0) { const parent = Math.floor((index - 1) / 2); if (heap[parent].priority <= entry.priority) break; heap[index] = heap[parent]; index = parent; }
      heap[index] = entry;
    };
    const pop = () => {
      const result = heap[0]; const tail = heap.pop()!;
      if (heap.length) { let index = 0; while (true) { const left = index * 2 + 1; const right = left + 1; if (left >= heap.length) break; const child = right < heap.length && heap[right].priority < heap[left].priority ? right : left; if (heap[child].priority >= tail.priority) break; heap[index] = heap[child]; index = child; } heap[index] = tail; }
      return result;
    };
    while (heap.length) {
      const { id: current } = pop(); const best = costs.get(current)!;
      if (current === goal) break;
      for (const next of graph.get(current) || []) {
        const candidate = best + next.cost;
        if (candidate < (costs.get(next.id) ?? Number.POSITIVE_INFINITY)) { costs.set(next.id, candidate); previous.set(next.id, current); push({ id: next.id, priority: candidate }); }
      }
    }
    const ids = [goal];
    while (ids[0] !== start && previous.has(ids[0])) ids.unshift(previous.get(ids[0])!);
    return [[site.stages[from].lng, site.stages[from].lat], ...ids.map((id) => { const n = nodeById.get(id)!; return [n.lng, n.lat] as Coordinate; }), [site.stages[to].lng, site.stages[to].lat]];
  };
  return site.stages.map((_, from) => site.stages.map((__, to) => route(from, to)));
}

export function chooseTargets(population: AgentPopulation, site: FestivalSite, sets: Set[], t: number, stageCounts: Uint32Array, rng: SeededRng): number {
  let changed = 0;
  const activeSets = site.stages.map((stage) => currentSet(sets, stage.id, t));
  const weights = new Float32Array(site.stages.length);
  for (let agent = 0; agent < population.count; agent += 1) {
    if (t < population.arrival[agent] || t >= population.departure[agent]) continue;
    const current = population.currentStage[agent];
    for (let stage = 0; stage < site.stages.length; stage += 1) {
      const set = activeSets[stage];
      const preference = set ? preferenceFor(population, agent, population.setIndex.get(set.id)!) : 0.06;
      const crowdRatio = stageCounts[stage] / Math.max(1, site.stages[stage].capacityHint * 0.25);
      const crowdPenalty = Math.max(0, crowdRatio - population.crowdTolerance[agent]) * 1.4;
      const travelPenalty = current >= 0 ? meters([site.stages[current].lng, site.stages[current].lat], [site.stages[stage].lng, site.stages[stage].lat]) / 2600 : 0.12;
      const inertia = current === stage ? 0.75 * population.commitment[agent] : 0;
      weights[stage] = Math.exp((preference + inertia - crowdPenalty - travelPenalty) * 2.2);
    }
    const target = rng.weighted(weights);
    if (target !== population.targetStage[agent]) { population.targetStage[agent] = target; population.routeProgress[agent] = 0; changed += 1; }
  }
  return changed;
}

export function moveAgents(population: AgentPopulation, site: FestivalSite, routes: RouteTable, t: number, dtSeconds: number, seed: number): Uint32Array {
  const counts = new Uint32Array(site.stages.length);
  const noise = createNoise2D(() => new SeededRng(seed ^ Math.floor(t / 60_000)).float());
  for (let i = 0; i < population.count; i += 1) {
    if (t < population.arrival[i] || t >= population.departure[i]) continue;
    const target = population.targetStage[i];
    if (target < 0) continue;
    const from = population.currentStage[i] < 0 ? target : population.currentStage[i];
    const route = routes[from][target];
    let waypoint = Math.min(population.routeProgress[i], route.length - 1);
    let budget = population.speed[i] * dtSeconds;
    while (budget > 0 && waypoint < route.length) {
      const here: Coordinate = [population.lng[i], population.lat[i]];
      const next = route[waypoint];
      const remaining = meters(here, next);
      if (remaining <= budget) { population.lng[i] = next[0]; population.lat[i] = next[1]; budget -= remaining; waypoint += 1; }
      else {
        const fraction = budget / remaining;
        population.lng[i] += (next[0] - population.lng[i]) * fraction;
        population.lat[i] += (next[1] - population.lat[i]) * fraction;
        budget = 0;
      }
    }
    population.routeProgress[i] = waypoint;
    if (waypoint >= route.length) {
      population.currentStage[i] = target;
      const radiusM = 16 + (i % 67) * 0.55;
      const angle = noise(i * 0.013, target * 0.7) * Math.PI + (i * 2.399963);
      population.lng[i] = site.stages[target].lng + Math.cos(angle) * radiusM / (111_320 * Math.cos(site.stages[target].lat * Math.PI / 180));
      population.lat[i] = site.stages[target].lat + Math.sin(angle) * radiusM / 110_540;
      counts[target] += 1;
    }
  }
  projectCollisions(population, t, 0.35, 0.08);
  return counts;
}

/** Position-based non-penetration projection over a spatial hash. */
export function projectCollisions(population: AgentPopulation, t: number, radiusM: number, compliance: number): void {
  const cellM = radiusM * 2;
  const originLat = 37.769;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const grid = new Map<string, number[]>();
    for (let i = 0; i < population.count; i += 1) {
      if (t < population.arrival[i] || t >= population.departure[i] || population.targetStage[i] < 0) continue;
      const x = population.lng[i] * 111_320 * Math.cos(originLat * Math.PI / 180);
      const y = population.lat[i] * 110_540;
      const key = `${Math.floor(x / cellM)},${Math.floor(y / cellM)}`;
      const bucket = grid.get(key); if (bucket) bucket.push(i); else grid.set(key, [i]);
    }
    for (const bucket of grid.values()) for (let a = 0; a < bucket.length; a += 1) for (let b = a + 1; b < bucket.length; b += 1) {
      const i = bucket[a]; const j = bucket[b];
      const dx = (population.lng[j] - population.lng[i]) * 111_320 * Math.cos(originLat * Math.PI / 180);
      const dy = (population.lat[j] - population.lat[i]) * 110_540;
      const distance = Math.hypot(dx, dy) || 0.001; const overlap = radiusM * 2 - distance;
      if (overlap <= 0) continue;
      const correction = overlap * (1 - compliance) * 0.5 / distance;
      population.lng[i] -= dx * correction / (111_320 * Math.cos(originLat * Math.PI / 180));
      population.lat[i] -= dy * correction / 110_540;
      population.lng[j] += dx * correction / (111_320 * Math.cos(originLat * Math.PI / 180));
      population.lat[j] += dy * correction / 110_540;
    }
  }
}
