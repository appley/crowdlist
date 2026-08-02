import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import site from "../src/festivals/outside-lands.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const geometry = JSON.parse(await readFile(resolve(root, "src/festivals/golden-gate-park.geojson"), "utf8")) as GeoJSON.FeatureCollection;
const paths = geometry.features.filter((feature): feature is GeoJSON.Feature<GeoJSON.LineString, { kind: string; from: string; to: string }> => feature.properties?.kind === "path" && feature.geometry.type === "LineString");
const barriers = geometry.features.filter((feature): feature is GeoJSON.Feature<GeoJSON.Polygon> => feature.properties?.kind === "barrier" && feature.geometry.type === "Polygon");
const nodeIds = new Set<string>();
const adjacency = new Map<string, string[]>();
let lengthM = 0;
const distance = (a: number[], b: number[]) => {
  const lat = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const x = (b[0] - a[0]) * Math.PI / 180 * Math.cos(lat);
  const y = (b[1] - a[1]) * Math.PI / 180;
  return Math.hypot(x, y) * 6371000;
};
const inside = (point: number[], polygon: number[][]) => {
  let contained = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    if (((a[1] > point[1]) !== (b[1] > point[1])) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) contained = !contained;
  }
  return contained;
};
for (const feature of paths) {
  const { from, to } = feature.properties;
  nodeIds.add(from); nodeIds.add(to);
  adjacency.set(from, [...(adjacency.get(from) || []), to]);
  adjacency.set(to, [...(adjacency.get(to) || []), from]);
  lengthM += distance(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
  const [a, b] = feature.geometry.coordinates;
  const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (barriers.some((barrier) => inside(midpoint, barrier.geometry.coordinates[0]))) throw new Error(`Path edge ${from} → ${to} crosses a barrier polygon`);
}
const reached = new Set<string>();
const stack = [nodeIds.values().next().value as string];
while (stack.length) { const id = stack.pop()!; if (reached.has(id)) continue; reached.add(id); stack.push(...(adjacency.get(id) || [])); }
if (reached.size !== nodeIds.size) throw new Error(`Path graph is disconnected: ${reached.size}/${nodeIds.size}`);
if (lengthM < 10_000 || lengthM > 1_000_000) throw new Error(`Implausible total path length: ${Math.round(lengthM)}m`);
for (const stage of site.stages) {
  const [west, south, east, north] = site.bbox;
  if (stage.lng < west || stage.lng > east || stage.lat < south || stage.lat > north) throw new Error(`${stage.name} falls outside the park footprint`);
  let nearest = Number.POSITIVE_INFINITY;
  for (const id of nodeIds) {
    const [lat, lng] = id.split(",").map(Number);
    nearest = Math.min(nearest, distance([stage.lng, stage.lat], [lng, lat]));
  }
  if (nearest > 250) throw new Error(`${stage.name} is ${Math.round(nearest)}m from the routable graph`);
}
console.log(`Validated one connected component, ${site.stages.length} reachable stages, ${Math.round(lengthM / 1000)} km of path segments`);
