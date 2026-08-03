import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Usage: node scripts/import-crowdsim-graph.mjs <krish-dev golden-gate-park.geojson>");
}

const source = JSON.parse(readFileSync(resolve(sourcePath), "utf8"));
const stages = JSON.parse(readFileSync(resolve(root, "data/ol26/stages.geojson"), "utf8"));
const nodes = new Map();
const edges = new Map();
const adjacency = new Map();

function distanceMeters(a, b) {
  const latitude = ((a.lat + b.lat) / 2) * Math.PI / 180;
  return Math.hypot(
    (b.lng - a.lng) * 111_320 * Math.cos(latitude),
    (b.lat - a.lat) * 110_540,
  );
}

function addNeighbor(from, entry) {
  const neighbors = adjacency.get(from);
  if (neighbors) neighbors.push(entry);
  else adjacency.set(from, [entry]);
}

for (const feature of source.features) {
  if (feature.properties?.kind !== "path" || feature.geometry?.type !== "LineString") continue;
  const { from, to } = feature.properties;
  const coordinates = feature.geometry.coordinates;
  if (!from || !to || coordinates.length < 2) continue;
  const fromNode = { id: from, lng: coordinates[0][0], lat: coordinates[0][1] };
  const toNode = { id: to, lng: coordinates.at(-1)[0], lat: coordinates.at(-1)[1] };
  nodes.set(from, fromNode);
  nodes.set(to, toNode);
  const widthM = Number(feature.properties.widthM) || 2.5;
  const key = [from, to].sort().join("|");
  const edge = { from, to, widthM };
  edges.set(key, edge);
  const cost = distanceMeters(fromNode, toNode) / Math.max(1, widthM);
  addNeighbor(from, { id: to, cost, key });
  addNeighbor(to, { id: from, cost, key });
}

const stageNodes = stages.features.map((feature) => {
  const [lng, lat] = feature.geometry.coordinates;
  let nearest = null;
  for (const node of nodes.values()) {
    const distance = distanceMeters({ lng, lat }, node);
    if (!nearest || distance < nearest.distance) nearest = { id: node.id, distance };
  }
  return { stageId: feature.properties.id, nodeId: nearest.id, distanceM: Math.round(nearest.distance) };
});

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

function shortestPath(start, goal) {
  const costs = new Map([[start, 0]]);
  const previous = new Map();
  const heap = new MinHeap();
  heap.push({ id: start, cost: 0 });
  while (heap.values.length) {
    const current = heap.pop();
    if (current.cost !== costs.get(current.id)) continue;
    if (current.id === goal) break;
    for (const next of adjacency.get(current.id) ?? []) {
      const cost = current.cost + next.cost;
      if (cost >= (costs.get(next.id) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(next.id, cost);
      previous.set(next.id, { id: current.id, key: next.key });
      heap.push({ id: next.id, cost });
    }
  }
  if (!previous.has(goal)) throw new Error(`No CrowdSim path connects ${start} to ${goal}`);
  const path = [];
  let cursor = goal;
  while (cursor !== start) {
    const step = previous.get(cursor);
    path.unshift(step.key);
    cursor = step.id;
  }
  return path;
}

const selectedEdges = new Set();
for (let from = 0; from < stageNodes.length; from += 1) {
  for (let to = from + 1; to < stageNodes.length; to += 1) {
    for (const edge of shortestPath(stageNodes[from].nodeId, stageNodes[to].nodeId)) selectedEdges.add(edge);
  }
}
const compactEdges = [...selectedEdges].sort().map((key) => edges.get(key));
const selectedNodes = new Set(compactEdges.flatMap((edge) => [edge.from, edge.to]));
const compactNodes = [...selectedNodes].sort().map((id) => nodes.get(id));
const output = {
  meta: {
    source: "krish-dev CrowdSim OSM path graph",
    sourceCommit: "16dfaae",
    importedAt: "2026-08-03T00:00:00.000Z",
  },
  stageNodes,
  nodes: compactNodes,
  edges: compactEdges,
};
const outputPath = resolve(root, "data/ol26/path-graph.json");
writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Imported ${compactNodes.length} nodes and ${compactEdges.length} edges to ${outputPath}.`);
