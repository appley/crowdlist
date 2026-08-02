import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import site from "../src/festivals/outside-lands.json" with { type: "json" };

const samples: Record<string, number> = {};
async function fetchElevation(url: URL): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      const body = await response.json() as { value?: number | string };
      const elevation = Number(body.value);
      if (Number.isFinite(elevation)) return elevation;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error("USGS elevation request failed after three attempts");
}
for (const stage of site.stages) {
  const url = new URL("https://epqs.nationalmap.gov/v1/json");
  url.searchParams.set("x", String(stage.lng)); url.searchParams.set("y", String(stage.lat));
  url.searchParams.set("units", "Meters"); url.searchParams.set("wkid", "4326"); url.searchParams.set("includeDate", "false");
  samples[stage.id] = await fetchElevation(url);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await writeFile(resolve(root, "src/festivals/golden-gate-park-elevation.json"), `${JSON.stringify({ source: "USGS 3DEP EPQS", samples })}\n`);
console.log(`Cached ${Object.keys(samples).length} USGS elevation samples`);
