import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "src/festivals/golden-gate-park.osm.json");
const bbox = "37.7630,-122.5110,37.7750,-122.4740";
const query = `[out:json][timeout:180];(
way["highway"~"^(footway|path|cycleway|pedestrian|steps|track|service|residential|tertiary|secondary)$"](${bbox});
way["barrier"](${bbox}); way["natural"="water"](${bbox}); way["waterway"](${bbox});
way["landuse"~"^(grass|meadow|forest|recreation_ground)$"](${bbox});
way["leisure"~"^(park|pitch|garden|playground|stadium)$"](${bbox}); way["building"](${bbox});
);out body geom;`;

const response = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ data: query }),
});
if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, await response.text());
console.log(`Cached OSM extract at ${output}`);
