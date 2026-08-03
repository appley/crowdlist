import { cellToLatLng, latLngToCell } from "h3-js";
import { createNoise2D } from "simplex-noise";

// Ported from krish-dev/crowdsim (16dfaae). The UI consumes only aggregate,
// privacy-thresholded output; individual agents never ship to the browser.
export class SeededRng {
  constructor(seed) {
    const mix = (value) => {
      value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
      value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
      return (value ^ (value >>> 15)) >>> 0;
    };
    this.a = mix(seed || 1);
    this.b = mix(this.a + 0x9e3779b9);
    this.c = mix(this.b + 0x9e3779b9);
    this.d = mix(this.c + 0x9e3779b9);
    this.spare = null;
  }
  nextUint32() {
    const tail = this.d;
    const head = this.a;
    this.d = this.c;
    this.c = this.b;
    this.b = head;
    let value = tail ^ (tail << 11);
    value ^= value >>> 8;
    this.a = (value ^ head ^ (head >>> 19)) >>> 0;
    return this.a;
  }
  float() { return this.nextUint32() / 0x100000000; }
  range(minimum, maximum) { return minimum + this.float() * (maximum - minimum); }
  int(maximum) { return Math.floor(this.float() * maximum); }
  normal(mean = 0, deviation = 1) {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return mean + value * deviation;
    }
    const u = Math.max(this.float(), Number.EPSILON);
    const v = this.float();
    const magnitude = Math.sqrt(-2 * Math.log(u));
    this.spare = magnitude * Math.sin(2 * Math.PI * v);
    return mean + magnitude * Math.cos(2 * Math.PI * v) * deviation;
  }
  weighted(weights) {
    let total = 0;
    for (let index = 0; index < weights.length; index += 1) total += Math.max(0, weights[index]);
    let needle = this.float() * total;
    for (let index = 0; index < weights.length; index += 1) {
      needle -= Math.max(0, weights[index]);
      if (needle <= 0) return index;
    }
    return Math.max(0, weights.length - 1);
  }
}

function distanceMeters(a, b) {
  const latitude = ((a[1] + b[1]) / 2) * Math.PI / 180;
  return Math.hypot(
    (b[0] - a[0]) * 111_320 * Math.cos(latitude),
    (b[1] - a[1]) * 110_540,
  );
}

function createAgents(count, sets, start, end, seed, gate) {
  const rng = new SeededRng(seed);
  const clusterCount = 6;
  const clusterPreference = new Float32Array(clusterCount * sets.length);
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
      const affinity = ((setIndex * 11 + cluster * 5) % clusterCount) === cluster ? 0.62 : 0.18;
      clusterPreference[cluster * sets.length + setIndex] = Math.min(
        1,
        affinity + rng.range(0, 0.34) + sets[setIndex].popularity * 0.22,
      );
    }
  }
  const population = {
    count,
    lng: new Float32Array(count),
    lat: new Float32Array(count),
    targetStage: new Int16Array(count),
    currentStage: new Int16Array(count),
    routeProgress: new Uint16Array(count),
    commitment: new Float32Array(count),
    crowdTolerance: new Float32Array(count),
    arrival: new Float64Array(count),
    departure: new Float64Array(count),
    speed: new Float32Array(count),
    tasteCluster: new Uint8Array(count),
    tasteBlend: new Float32Array(count),
    clusterPreference,
    setIndex: new Map(sets.map((set, index) => [set.id, index])),
  };
  population.targetStage.fill(-1);
  population.currentStage.fill(-1);
  const span = end - start;
  for (let index = 0; index < count; index += 1) {
    population.lng[index] = gate[0] + rng.normal(0, 0.00025);
    population.lat[index] = gate[1] + rng.normal(0, 0.00018);
    population.commitment[index] = Math.min(1, Math.max(0, rng.normal(0.68, 0.19)));
    population.crowdTolerance[index] = Math.min(1, Math.max(0, rng.normal(0.56, 0.24)));
    const arrivalFraction = Math.min(0.72, Math.max(0, Math.pow(rng.float(), 1.7)));
    population.arrival[index] = start + arrivalFraction * span;
    population.departure[index] = Math.min(
      end,
      start + span * Math.max(arrivalFraction + 0.15, Math.min(1, rng.normal(0.94, 0.07))),
    );
    population.speed[index] = Math.min(1.9, Math.max(0.75, rng.normal(1.3, 0.18)));
    population.tasteCluster[index] = rng.int(clusterCount);
    population.tasteBlend[index] = rng.float();
  }
  return population;
}

function preferenceFor(population, agent, setIndex) {
  const cluster = population.tasteCluster[agent];
  const adjacent = (cluster + 1) % 6;
  const stride = population.setIndex.size;
  const primary = population.clusterPreference[cluster * stride + setIndex] || 0;
  const secondary = population.clusterPreference[adjacent * stride + setIndex] || 0;
  return primary * (0.7 + population.tasteBlend[agent] * 0.25) + secondary * 0.22;
}

class MinHeap {
  values = [];
  push(value) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].cost <= value.cost) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }
  pop() {
    const first = this.values[0];
    const tail = this.values.pop();
    if (this.values.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        const child = right < this.values.length && this.values[right].cost < this.values[left].cost ? right : left;
        if (this.values[child].cost >= tail.cost) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = tail;
    }
    return first;
  }
}

export function buildRoutes(site) {
  const nodeById = new Map(site.pathGraph.nodes.map((node) => [node.id, node]));
  const graph = new Map();
  for (const edge of site.pathGraph.edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    const cost = distanceMeters([from.lng, from.lat], [to.lng, to.lat]) / Math.max(1, edge.widthM);
    graph.set(edge.from, [...(graph.get(edge.from) ?? []), { id: edge.to, cost }]);
    graph.set(edge.to, [...(graph.get(edge.to) ?? []), { id: edge.from, cost }]);
  }
  const nearest = site.stages.map((stage) => site.pathGraph.nodes.reduce((best, node) => {
    const distance = distanceMeters([stage.lng, stage.lat], [node.lng, node.lat]);
    return distance < best.distance ? { id: node.id, distance } : best;
  }, { id: site.pathGraph.nodes[0].id, distance: Number.POSITIVE_INFINITY }).id);

  const route = (fromStage, toStage) => {
    if (fromStage === toStage) return [[site.stages[toStage].lng, site.stages[toStage].lat]];
    const start = nearest[fromStage];
    const goal = nearest[toStage];
    const costs = new Map([[start, 0]]);
    const previous = new Map();
    const heap = new MinHeap();
    heap.push({ id: start, cost: 0 });
    while (heap.values.length) {
      const current = heap.pop();
      if (current.cost !== costs.get(current.id)) continue;
      if (current.id === goal) break;
      for (const next of graph.get(current.id) ?? []) {
        const candidate = current.cost + next.cost;
        if (candidate >= (costs.get(next.id) ?? Number.POSITIVE_INFINITY)) continue;
        costs.set(next.id, candidate);
        previous.set(next.id, current.id);
        heap.push({ id: next.id, cost: candidate });
      }
    }
    const ids = [goal];
    while (ids[0] !== start && previous.has(ids[0])) ids.unshift(previous.get(ids[0]));
    return [
      [site.stages[fromStage].lng, site.stages[fromStage].lat],
      ...ids.map((id) => {
        const node = nodeById.get(id);
        return [node.lng, node.lat];
      }),
      [site.stages[toStage].lng, site.stages[toStage].lat],
    ];
  };
  return site.stages.map((_, from) => site.stages.map((__, to) => route(from, to)));
}

function currentSet(sets, stageId, time) {
  return sets.find((set) => set.stageId === stageId && set.startsAt <= time && set.endsAt > time);
}

function chooseTargets(population, site, sets, time, stageCounts, rng) {
  const activeSets = site.stages.map((stage) => currentSet(sets, stage.id, time));
  const weights = new Float32Array(site.stages.length);
  const migrations = new Map();
  let changed = 0;
  for (let agent = 0; agent < population.count; agent += 1) {
    if (time < population.arrival[agent] || time >= population.departure[agent]) continue;
    const current = population.currentStage[agent];
    for (let stageIndex = 0; stageIndex < site.stages.length; stageIndex += 1) {
      const set = activeSets[stageIndex];
      const preference = set ? preferenceFor(population, agent, population.setIndex.get(set.id)) : 0.06;
      const crowdRatio = stageCounts[stageIndex] / Math.max(1, site.stages[stageIndex].capacityHint * 0.25);
      const crowdPenalty = Math.max(0, crowdRatio - population.crowdTolerance[agent]) * 1.4;
      const travelPenalty = current >= 0
        ? distanceMeters(
            [site.stages[current].lng, site.stages[current].lat],
            [site.stages[stageIndex].lng, site.stages[stageIndex].lat],
          ) / 2600
        : 0.12;
      const inertia = current === stageIndex ? 0.75 * population.commitment[agent] : 0;
      weights[stageIndex] = Math.exp((preference + inertia - crowdPenalty - travelPenalty) * 2.2);
    }
    const target = rng.weighted(weights);
    if (target === population.targetStage[agent]) continue;
    if (current >= 0 && current !== target) {
      const key = `${current}:${target}`;
      migrations.set(key, (migrations.get(key) ?? 0) + 1);
    }
    population.targetStage[agent] = target;
    population.routeProgress[agent] = 0;
    changed += 1;
  }
  return { changed, migrations };
}

function projectCollisions(population, time, radiusM = 0.35, compliance = 0.08) {
  const cellM = radiusM * 2;
  const originLatitude = 37.769;
  const longitudeScale = 111_320 * Math.cos(originLatitude * Math.PI / 180);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const grid = new Map();
    for (let index = 0; index < population.count; index += 1) {
      if (time < population.arrival[index] || time >= population.departure[index] || population.targetStage[index] < 0) continue;
      const key = `${Math.floor(population.lng[index] * longitudeScale / cellM)},${Math.floor(population.lat[index] * 110_540 / cellM)}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(index);
      else grid.set(key, [index]);
    }
    for (const bucket of grid.values()) {
      for (let first = 0; first < bucket.length; first += 1) {
        for (let second = first + 1; second < bucket.length; second += 1) {
          const left = bucket[first];
          const right = bucket[second];
          const dx = (population.lng[right] - population.lng[left]) * longitudeScale;
          const dy = (population.lat[right] - population.lat[left]) * 110_540;
          const distance = Math.hypot(dx, dy) || 0.001;
          const overlap = radiusM * 2 - distance;
          if (overlap <= 0) continue;
          const correction = overlap * (1 - compliance) * 0.5 / distance;
          population.lng[left] -= dx * correction / longitudeScale;
          population.lat[left] -= dy * correction / 110_540;
          population.lng[right] += dx * correction / longitudeScale;
          population.lat[right] += dy * correction / 110_540;
        }
      }
    }
  }
}

function moveAgents(population, site, routes, time, seconds, seed) {
  const counts = new Uint32Array(site.stages.length);
  const noiseRng = new SeededRng(seed ^ Math.floor(time / 60_000));
  const noise = createNoise2D(() => noiseRng.float());
  for (let index = 0; index < population.count; index += 1) {
    if (time < population.arrival[index] || time >= population.departure[index]) continue;
    const target = population.targetStage[index];
    if (target < 0) continue;
    const from = population.currentStage[index] < 0 ? target : population.currentStage[index];
    const route = routes[from][target];
    let waypoint = Math.min(population.routeProgress[index], route.length - 1);
    let budget = population.speed[index] * seconds;
    while (budget > 0 && waypoint < route.length) {
      const here = [population.lng[index], population.lat[index]];
      const next = route[waypoint];
      const remaining = distanceMeters(here, next);
      if (remaining <= budget) {
        population.lng[index] = next[0];
        population.lat[index] = next[1];
        budget -= remaining;
        waypoint += 1;
      } else {
        const fraction = budget / remaining;
        population.lng[index] += (next[0] - population.lng[index]) * fraction;
        population.lat[index] += (next[1] - population.lat[index]) * fraction;
        budget = 0;
      }
    }
    population.routeProgress[index] = waypoint;
    if (waypoint >= route.length) {
      population.currentStage[index] = target;
      const radiusM = 16 + (index % 67) * 0.55;
      const angle = noise(index * 0.013, target * 0.7) * Math.PI + index * 2.399963;
      population.lng[index] = site.stages[target].lng + Math.cos(angle) * radiusM /
        (111_320 * Math.cos(site.stages[target].lat * Math.PI / 180));
      population.lat[index] = site.stages[target].lat + Math.sin(angle) * radiusM / 110_540;
      counts[target] += 1;
    }
  }
  projectCollisions(population, time);
  return counts;
}

function aggregateDensity(population, time, resolution, kAnonymity) {
  const counts = new Map();
  for (let index = 0; index < population.count; index += 1) {
    if (time < population.arrival[index] || time >= population.departure[index] || population.targetStage[index] < 0) continue;
    const h3 = latLngToCell(population.lat[index], population.lng[index], resolution);
    counts.set(h3, (counts.get(h3) ?? 0) + 1);
  }
  const bucketTime = Math.floor(time / 60_000) * 60_000;
  return [...counts.entries()]
    .filter(([, contributors]) => contributors >= kAnonymity)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([h3, contributors]) => ({
      h3,
      t: bucketTime,
      n: contributors,
      confidence: Number((1 - Math.exp(-(contributors - kAnonymity + 1) / 18)).toFixed(6)),
    }));
}

export function runSimulation({ config, site, sets }) {
  const start = Date.parse(config.startTime);
  const end = Date.parse(config.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid simulation range");
  const gate = [site.stages[0].lng, site.stages[0].lat];
  const agents = createAgents(config.agentCount, sets, start, end, config.seed, gate);
  const routes = buildRoutes(site);
  const rng = new SeededRng(config.seed ^ 0xa5a5a5a5);
  const boundaries = new Set(sets.flatMap((set) => [set.startsAt, set.endsAt]));
  const boundaryList = [...boundaries];
  const density = [];
  const migrations = [];
  let stageCounts = new Uint32Array(site.stages.length);
  let lastDecision = start - 10 * 60_000;
  for (let time = start; time <= end; time += config.densityIntervalSeconds * 1000) {
    const nearBoundary = boundaryList.some((boundary) => Math.abs(boundary - time) <= config.densityIntervalSeconds * 1000);
    if (nearBoundary || time - lastDecision >= 15 * 60_000) {
      const decision = chooseTargets(agents, site, sets, time, stageCounts, rng);
      for (const [key, count] of decision.migrations) {
        if (count < 5) continue;
        const [from, to] = key.split(":").map(Number);
        migrations.push({ time, from, to, count });
      }
      lastDecision = time;
    }
    stageCounts = moveAgents(agents, site, routes, time, config.densityIntervalSeconds, config.seed);
    density.push(...aggregateDensity(agents, time, site.h3Resolution, config.kAnonymity));
  }
  return { density, migrations, routes, cellToLatLng };
}
