// Builds the CrowdList vector basemap from OpenStreetMap.
//
// The official patron map is an illustration, not a survey. Rasterizing it
// looks soft under zoom and its geography is stretched, so V1 draws Golden
// Gate Park from real OSM geometry and colors it like the illustration.
//
// Usage: node scripts/build-basemap.mjs
// Output: data/ol26/ggp-base.json (OpenStreetMap contributors, ODbL)

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const BBOX = [37.7600, -122.5250, 37.7810, -122.4450];
const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const OUTPUT = new URL("../data/ol26/ggp-base.json", import.meta.url).pathname;
const CACHE = new URL("../.cache/overpass.json", import.meta.url).pathname;

// Keep the file small: the map never leaves the festival grounds.
const CLIP = { west: -122.5140, east: -122.4640, south: 37.7620, north: 37.7780 };

const QUERY = `[out:json][timeout:90];
(
  way["leisure"="park"](${BBOX.join(",")});
  way["natural"="water"](${BBOX.join(",")});
  way["landuse"~"grass|meadow|forest|recreation_ground"](${BBOX.join(",")});
  way["natural"="wood"](${BBOX.join(",")});
  way["leisure"~"pitch|garden|stadium|track"](${BBOX.join(",")});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$"](${BBOX.join(",")});
);
out geom;`;

async function overpass() {
  try {
    return JSON.parse(await readFile(CACHE, "utf8"));
  } catch {
    // fall through to the network
  }
  for (const mirror of MIRRORS) {
    const response = await fetch(mirror, {
      method: "POST",
      body: new URLSearchParams({ data: QUERY }),
    });
    if (!response.ok) continue;
    const payload = await response.json();
    await mkdir(dirname(CACHE), { recursive: true });
    await writeFile(CACHE, JSON.stringify(payload));
    return payload;
  }
  throw new Error("Every Overpass mirror refused the request");
}

const round = (value) => Math.round(value * 1e5) / 1e5;
const ring = (geometry) => geometry.map((point) => [round(point.lon), round(point.lat)]);

function intersectsClip(geometry) {
  return geometry.some(
    (point) =>
      point.lon >= CLIP.west && point.lon <= CLIP.east &&
      point.lat >= CLIP.south && point.lat <= CLIP.north,
  );
}

const closed = (geometry) =>
  geometry.length > 3 &&
  geometry[0].lat === geometry.at(-1).lat &&
  geometry[0].lon === geometry.at(-1).lon;

// Rough square-degree area; only used to drop specks.
function area(coordinates) {
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [x1, y1] = coordinates[i];
    const [x2, y2] = coordinates[i + 1];
    total += x1 * y2 - x2 * y1;
  }
  return Math.abs(total / 2);
}

function classify(tags) {
  if (tags.natural === "water") return { kind: "water" };
  if (tags.leisure === "park") return { kind: "park" };
  if (tags.natural === "wood" || tags.landuse === "forest") return { kind: "wood" };
  if (tags.leisure === "stadium" || tags.leisure === "track") return { kind: "field" };
  if (["grass", "meadow", "recreation_ground"].includes(tags.landuse)) return { kind: "grass" };
  if (["pitch", "garden"].includes(tags.leisure)) return { kind: "grass" };
  if (!tags.highway) return null;
  // Kinds stay plain strings so every style filter is a string comparison;
  // a numeric rank would be null on polygons and break the filter's typing.
  if (["motorway", "trunk", "primary", "secondary", "tertiary"].includes(tags.highway)) {
    return { kind: "road-major" };
  }
  if (["residential", "unclassified"].includes(tags.highway)) return { kind: "road-park" };
  return { kind: "road-service" };
}

const payload = await overpass();

// The printed map draws the park and the streets that bound it, nothing else.
// Everything but those boundary streets is clipped to the park itself so the
// Richmond and Sunset block grids stay off the canvas.
const parkBoundary = payload.elements.find(
  (element) => element.tags?.leisure === "park" && element.tags?.name === "Golden Gate Park",
);
if (!parkBoundary?.geometry) throw new Error("OSM is missing the Golden Gate Park boundary");
const PARK_RING = parkBoundary.geometry.map((point) => [point.lon, point.lat]);

function inPark([x, y]) {
  let inside = false;
  for (let i = 0, j = PARK_RING.length - 1; i < PARK_RING.length; j = i, i += 1) {
    const [xi, yi] = PARK_RING[i];
    const [xj, yj] = PARK_RING[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const touchesPark = (coordinates) => coordinates.some(inPark);

const features = [];

for (const element of payload.elements ?? []) {
  const tags = element.tags ?? {};
  const geometry = element.geometry?.filter(Boolean);
  if (!geometry?.length || !intersectsClip(geometry)) continue;
  const type = classify(tags);
  if (!type) continue;

  const coordinates = ring(geometry);
  const properties = { kind: type.kind };
  if (tags.name) properties.name = tags.name;

  if (type.kind.startsWith("road")) {
    // Unnamed driveways and parking aisles are noise at festival zoom.
    if (type.kind === "road-service" && !tags.name) continue;
    // Park drives are drawn; the surrounding city grid is not.
    if (type.kind !== "road-major" && !touchesPark(coordinates)) continue;
    features.push({ type: "Feature", properties, geometry: { type: "LineString", coordinates } });
    continue;
  }

  if (!closed(geometry)) continue;
  if (area(coordinates) < 2e-8) continue;
  if (type.kind !== "park" && !touchesPark(coordinates)) continue;
  features.push({
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates: [coordinates] },
  });
}

// Big polygons first so the park sits under its meadows and lakes.
const order = { park: 0, wood: 1, grass: 2, field: 3, water: 4 };
features.sort((a, b) => (order[a.properties.kind] ?? 5) - (order[b.properties.kind] ?? 5));

const collection = {
  type: "FeatureCollection",
  attribution: "© OpenStreetMap contributors",
  license: "ODbL 1.0",
  generated: "scripts/build-basemap.mjs",
  features,
};

await writeFile(OUTPUT, JSON.stringify(collection));
const counts = features.reduce((totals, feature) => {
  totals[feature.properties.kind] = (totals[feature.properties.kind] ?? 0) + 1;
  return totals;
}, {});
console.log(`${features.length} features ->`, counts);
