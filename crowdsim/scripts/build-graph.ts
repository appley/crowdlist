import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Point = { lat: number; lon: number };
type OsmWay = { type: "way"; id: number; tags?: Record<string, string>; geometry?: Point[] };
type Edge = { from: string; to: string; widthM: number; highway: string; coordinates: [number, number][] };
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, "src/festivals/golden-gate-park.osm.json");
const output = resolve(root, "src/festivals/golden-gate-park.geojson");
const data = JSON.parse(await readFile(input, "utf8")) as { elements: OsmWay[] };
const widths: Record<string, number> = { steps: 1.5, path: 2, footway: 2.5, cycleway: 3, service: 4, pedestrian: 6, residential: 8, tertiary: 10, secondary: 12, track: 3 };
const key = (p: Point) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
const inside = (point: number[], polygon: number[][]) => {
  let contained = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    if (((a[1] > point[1]) !== (b[1] > point[1])) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) contained = !contained;
  }
  return contained;
};
const nodes = new Map<string, { id: string; lat: number; lng: number }>();
const edges: Edge[] = [];

for (const way of data.elements) {
  const highway = way.tags?.highway;
  if (!highway || !way.geometry || way.geometry.length < 2) continue;
  const width = Number.parseFloat(way.tags?.width || "") || widths[highway] || 2.5;
  for (let i = 1; i < way.geometry.length; i += 1) {
    const a = way.geometry[i - 1];
    const b = way.geometry[i];
    const from = key(a);
    const to = key(b);
    nodes.set(from, { id: from, lat: a.lat, lng: a.lon });
    nodes.set(to, { id: to, lat: b.lat, lng: b.lon });
    edges.push({ from, to, widthM: width, highway, coordinates: [[a.lon, a.lat], [b.lon, b.lat]] });
  }
}

const barrierWays = data.elements.flatMap((way) => {
  const tags = way.tags || {};
  if (!way.geometry?.length || !(tags.building || tags.natural === "water" || tags.waterway)) return [];
  const coordinates = way.geometry.map((p) => [p.lon, p.lat]);
  if (coordinates.length < 4 || coordinates[0][0] !== coordinates.at(-1)![0] || coordinates[0][1] !== coordinates.at(-1)![1]) return [];
  return [{ id: way.id, coordinates }];
});
const navigableEdges = edges.filter((edge) => {
  const [a, b] = edge.coordinates;
  const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return !barrierWays.some((barrier) => inside(midpoint, barrier.coordinates));
});
const adjacency = new Map<string, string[]>();
for (const edge of navigableEdges) {
  adjacency.set(edge.from, [...(adjacency.get(edge.from) || []), edge.to]);
  adjacency.set(edge.to, [...(adjacency.get(edge.to) || []), edge.from]);
}
let largest = new Set<string>();
const seen = new Set<string>();
for (const id of nodes.keys()) {
  if (seen.has(id)) continue;
  const component = new Set<string>();
  const stack = [id];
  seen.add(id);
  while (stack.length) {
    const current = stack.pop()!;
    component.add(current);
    for (const next of adjacency.get(current) || []) if (!seen.has(next)) { seen.add(next); stack.push(next); }
  }
  if (component.size > largest.size) largest = component;
}
const keptEdges = navigableEdges.filter((edge) => largest.has(edge.from) && largest.has(edge.to));
const lineFeatures = keptEdges.map((edge) => ({
  type: "Feature", properties: { kind: "path", from: edge.from, to: edge.to, widthM: edge.widthM, highway: edge.highway },
  geometry: { type: "LineString", coordinates: edge.coordinates },
}));
const barrierFeatures = barrierWays.map((way) => ({ type: "Feature", properties: { kind: "barrier", source: `osm-way-${way.id}` }, geometry: { type: "Polygon", coordinates: [way.coordinates] } }));
const park = { type: "Feature", properties: { kind: "park" }, geometry: { type: "Polygon", coordinates: [[[-122.511,37.763],[-122.474,37.763],[-122.474,37.775],[-122.511,37.775],[-122.511,37.763]]] } };
const collection = { type: "FeatureCollection", properties: { attribution: "© OpenStreetMap contributors", discardedNodes: nodes.size - largest.size }, features: [park, ...lineFeatures, ...barrierFeatures] };
await writeFile(output, `${JSON.stringify(collection)}\n`);
await mkdir(resolve(root, "public/data"), { recursive: true });
await writeFile(resolve(root, "public/data/golden-gate-park.geojson"), `${JSON.stringify(collection)}\n`);
console.log(`Graph: ${largest.size} nodes, ${keptEdges.length} edges, ${nodes.size - largest.size} nodes discarded`);
