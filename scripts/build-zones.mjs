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

// Longitude degrees are shorter than latitude degrees at this latitude, so
// distances are compared in roughly metric space.
const LON_SCALE = Math.cos((37.77 * Math.PI) / 180);
const distance = ([ax, ay], [bx, by]) =>
  Math.hypot((ax - bx) * LON_SCALE, ay - by);

// A stage marker is a dot with a name pill running to its right, so it blocks a
// box rather than a point. Values are degrees at festival zoom.
const PILL = { left: 0.00028, right: 0.00092, vertical: 0.00020 };

function clearanceFromPill(point, stage) {
  const dx = Math.max(stage[0] - PILL.left - point[0], point[0] - (stage[0] + PILL.right), 0);
  const dy = Math.max(stage[1] - PILL.vertical - point[1], point[1] - (stage[1] + PILL.vertical), 0);
  return Math.hypot(dx * LON_SCALE, dy);
}

/**
 * Where a zone's name should sit: clear of every stage pill, and inside its own
 * meadow when there is room. Thin meadows let the label sit just past their edge
 * rather than under a pill, which is what the printed map does with its
 * narrower zones.
 */
function labelAnchor(ring, stagePoints, otherRings = []) {
  const lons = ring.map((point) => point[0]);
  const lats = ring.map((point) => point[1]);
  const margin = 0.00055;
  const steps = 110;
  const [west, east] = [Math.min(...lons) - margin, Math.max(...lons) + margin];
  const [south, north] = [Math.min(...lats) - margin, Math.max(...lats) + margin];

  // Roughly 35 m: enough that a name and a pill read as separate things.
  const ROOM = 0.00035;
  let inner = null;
  let outer = null;

  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const point = [
        west + ((east - west) * i) / steps,
        south + ((north - south) * j) / steps,
      ];
      // Never let a label drift into a neighbouring zone's color.
      if (otherRings.some((other) => pointInPolygon(point, other))) continue;

      const inside = pointInPolygon(point, ring);
      const toOwnEdge = Math.min(...ring.map((vertex) => distance(point, vertex)));
      if (!inside && toOwnEdge > margin) continue;

      const clearance = stagePoints.length
        ? Math.min(...stagePoints.map((stage) => clearanceFromPill(point, stage)))
        : Infinity;
      const score = Math.min(clearance, 0.0016) + toOwnEdge * 0.15;
      const slot = inside ? "inner" : "outer";
      const current = slot === "inner" ? inner : outer;
      if (!current || score > current.score) {
        if (slot === "inner") inner = { score, point, clearance };
        else outer = { score, point, clearance };
      }
    }
  }

  // Stay in the meadow whenever it has room; only step outside to dodge a pill.
  if (inner && (inner.clearance >= ROOM || !outer || outer.clearance < ROOM)) return inner.point;
  return outer?.point ?? inner?.point ?? ring[0];
}

/** Longest-axis angle of a ring in screen degrees, for setting the label. */
function labelAngle(ring) {
  let longest = 0;
  let angle = 0;
  for (let i = 0; i < ring.length; i += 1) {
    for (let j = i + 1; j < ring.length; j += 1) {
      const dx = (ring[j][0] - ring[i][0]) * LON_SCALE;
      const dy = ring[j][1] - ring[i][1];
      const span = dx * dx + dy * dy;
      if (span > longest) {
        longest = span;
        angle = -Math.atan2(dy, dx) * (180 / Math.PI);
      }
    }
  }
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return Math.round(angle * 10) / 10;
}

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
const stageGeometry = JSON.parse(await readFile(STAGES, "utf8"));
const stagePoints = stageGeometry.features.map((feature) => feature.geometry.coordinates);

const rings = ZONES.map((zone) => {
  const element = payload.elements.find((candidate) => candidate.tags?.name === zone.osm);
  if (!element?.geometry) throw new Error(`OSM is missing ${zone.osm}`);
  return {
    ...zone,
    ring: element.geometry.map((point) => [round(point.lon), round(point.lat)]),
  };
});
rings.push({ ...MCLAREN_PASS, ring: MCLAREN_PASS.coordinates, authored: true });

const features = rings.map((zone, index) => {
  const others = rings.filter((_, other) => other !== index).map((other) => other.ring);
  const properties = {
    id: zone.id,
    name: zone.name,
    fill: zone.fill,
    ink: zone.ink,
    label: labelAnchor(zone.ring, stagePoints, others).map(round),
    angle: labelAngle(zone.ring),
  };
  if (zone.authored) properties.authored = true;
  return { type: "Feature", properties, geometry: { type: "Polygon", coordinates: [zone.ring] } };
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
