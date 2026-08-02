// Extracts the festival zone polygons the patron map colors, and checks that
// every stage point actually lands inside the zone it claims.
//
// Usage: node scripts/build-zones.mjs
// Output: data/ol26/zones.geojson

import { readFile, writeFile } from "node:fs/promises";

const CACHE = new URL("../.cache/overpass.json", import.meta.url).pathname;
const STAGES = new URL("../data/ol26/stages.geojson", import.meta.url).pathname;
const OUTPUT = new URL("../data/ol26/zones.geojson", import.meta.url).pathname;

// Zone fills follow the official legend, so the live layer reads against the
// same color language attendees see on the printed map.
const ZONES = [
  { osm: "Lindley Meadow", id: "lindley-meadow", name: "Lindley Meadow", fill: "#087d91", ink: "#f4fbfc" },
  { osm: "Marx Meadow", id: "marx-meadow", name: "Marx Meadow", fill: "#1d2420", ink: "#f2f7ee" },
  { osm: "Hellman Hollow", id: "hellman-hollow", name: "Hellman Hollow", fill: "#f4626e", ink: "#3b0c14" },
  { osm: "Golden Gate Park Polo Field and Stadium", id: "polo-field", name: "Polo Field", fill: "#f7b32b", ink: "#3d2703" },
];

// McLaren Pass is a festival name for the connector between Lindley Meadow and
// Hellman Hollow, so it has no OSM footprint and is authored here.
const MCLAREN_PASS = {
  id: "mclaren-pass",
  name: "McLaren Pass",
  fill: "#2f6b46",
  ink: "#eefaf1",
  coordinates: [
    [-122.48930, 37.77015],
    [-122.48600, 37.77080],
    [-122.48480, 37.76990],
    [-122.48760, 37.76930],
    [-122.48930, 37.77015],
  ],
};

function pointInPolygon([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > y !== yj > y;
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const payload = JSON.parse(await readFile(CACHE, "utf8"));
const round = (value) => Math.round(value * 1e5) / 1e5;

const features = ZONES.map((zone) => {
  const element = payload.elements.find((candidate) => candidate.tags?.name === zone.osm);
  if (!element?.geometry) throw new Error(`OSM is missing ${zone.osm}`);
  return {
    type: "Feature",
    properties: { id: zone.id, name: zone.name, fill: zone.fill, ink: zone.ink },
    geometry: {
      type: "Polygon",
      coordinates: [element.geometry.map((point) => [round(point.lon), round(point.lat)])],
    },
  };
});

features.push({
  type: "Feature",
  properties: {
    id: MCLAREN_PASS.id,
    name: MCLAREN_PASS.name,
    fill: MCLAREN_PASS.fill,
    ink: MCLAREN_PASS.ink,
    authored: true,
  },
  geometry: { type: "Polygon", coordinates: [MCLAREN_PASS.coordinates] },
});

await writeFile(OUTPUT, `${JSON.stringify({ type: "FeatureCollection", features }, null, 2)}\n`);

// Every stage must sit inside the zone its sheet names.
const stages = JSON.parse(await readFile(STAGES, "utf8"));
const zoneByName = new Map(features.map((feature) => [feature.properties.name, feature]));
let failures = 0;
for (const stage of stages.features) {
  const zone = zoneByName.get(stage.properties.zone);
  if (!zone) {
    console.log(`?  ${stage.properties.name.padEnd(16)} zone "${stage.properties.zone}" has no polygon`);
    failures += 1;
    continue;
  }
  const inside = pointInPolygon(stage.geometry.coordinates, zone.geometry.coordinates[0]);
  console.log(`${inside ? "ok" : "XX"} ${stage.properties.name.padEnd(16)} ${stage.properties.zone}`);
  if (!inside) failures += 1;
}
console.log(failures === 0 ? "\nAll stages sit inside their zone." : `\n${failures} stage(s) outside their zone.`);
process.exitCode = failures === 0 ? 0 : 1;
