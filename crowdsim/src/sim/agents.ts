import type { Set } from "../data/schema";
import { SeededRng } from "./rng";

export interface AgentPopulation {
  count: number;
  lng: Float32Array;
  lat: Float32Array;
  targetStage: Int16Array;
  currentStage: Int16Array;
  routeProgress: Uint16Array;
  commitment: Float32Array;
  crowdTolerance: Float32Array;
  arrival: Float64Array;
  departure: Float64Array;
  speed: Float32Array;
  tasteCluster: Uint8Array;
  tasteBlend: Float32Array;
  clusterPreference: Float32Array;
  setIndex: Map<string, number>;
}

export function createAgents(count: number, sets: Set[], start: number, end: number, seed: number, gate: [number, number]): AgentPopulation {
  const rng = new SeededRng(seed);
  const clusterCount = 6;
  const clusterPreference = new Float32Array(clusterCount * sets.length);
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    for (let set = 0; set < sets.length; set += 1) {
      const affinity = ((set * 11 + cluster * 5) % clusterCount) === cluster ? 0.62 : 0.18;
      clusterPreference[cluster * sets.length + set] = Math.min(1, affinity + rng.range(0, 0.34) + sets[set].popularity * 0.22);
    }
  }
  const population: AgentPopulation = {
    count,
    lng: new Float32Array(count), lat: new Float32Array(count), targetStage: new Int16Array(count), currentStage: new Int16Array(count),
    routeProgress: new Uint16Array(count), commitment: new Float32Array(count), crowdTolerance: new Float32Array(count),
    arrival: new Float64Array(count), departure: new Float64Array(count), speed: new Float32Array(count),
    tasteCluster: new Uint8Array(count), tasteBlend: new Float32Array(count), clusterPreference,
    setIndex: new Map(sets.map((set, index) => [set.id, index])),
  };
  const span = end - start;
  for (let i = 0; i < count; i += 1) {
    population.lng[i] = gate[0] + rng.normal(0, 0.00025);
    population.lat[i] = gate[1] + rng.normal(0, 0.00018);
    population.targetStage[i] = -1;
    population.currentStage[i] = -1;
    population.commitment[i] = Math.min(1, Math.max(0, rng.normal(0.68, 0.19)));
    population.crowdTolerance[i] = Math.min(1, Math.max(0, rng.normal(0.56, 0.24)));
    const arrivalFraction = Math.min(0.72, Math.max(0, Math.pow(rng.float(), 1.7)));
    population.arrival[i] = start + arrivalFraction * span;
    population.departure[i] = Math.min(end, start + span * Math.max(arrivalFraction + 0.15, Math.min(1, rng.normal(0.94, 0.07))));
    population.speed[i] = Math.min(1.9, Math.max(0.75, rng.normal(1.3, 0.18)));
    population.tasteCluster[i] = rng.int(clusterCount);
    population.tasteBlend[i] = rng.float();
  }
  return population;
}

export function preferenceFor(population: AgentPopulation, agent: number, setIndex: number): number {
  const cluster = population.tasteCluster[agent];
  const adjacent = (cluster + 1) % 6;
  const primary = population.clusterPreference[cluster * population.setIndex.size + setIndex] || 0;
  const secondary = population.clusterPreference[adjacent * population.setIndex.size + setIndex] || 0;
  return primary * (0.7 + population.tasteBlend[agent] * 0.25) + secondary * 0.22;
}
