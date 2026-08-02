import siteConfig from "../festivals/outside-lands.json";
import type { FestivalDay, FestivalSite, SimulationConfig, Stage } from "./schema";
import { runSimulation } from "../sim/run";

type GeometryProperties = { kind: "path" | "barrier" | "park"; from?: string; to?: string; widthM?: number };

function stageFootprint(lat: number, lng: number): GeoJSON.Polygon {
  const x = 0.00105; const y = 0.00062;
  return { type: "Polygon", coordinates: [[[lng - x, lat - y], [lng + x, lat - y], [lng + x, lat + y], [lng - x, lat + y], [lng - x, lat - y]]] };
}

export async function loadSite(): Promise<FestivalSite> {
  const response = await fetch("/crowdsim/data/golden-gate-park.geojson");
  if (!response.ok) throw new Error("Cached OSM path graph is unavailable");
  const geometry = await response.json() as GeoJSON.FeatureCollection<GeoJSON.Geometry, GeometryProperties>;
  const nodes = new Map<string, { id: string; lat: number; lng: number }>();
  const edges: FestivalSite["pathGraph"]["edges"] = [];
  const barriers: GeoJSON.Polygon[] = [];
  for (const feature of geometry.features) {
    if (feature.properties.kind === "path" && feature.geometry.type === "LineString") {
      const [a, b] = feature.geometry.coordinates;
      const from = feature.properties.from!; const to = feature.properties.to!;
      nodes.set(from, { id: from, lat: a[1], lng: a[0] });
      nodes.set(to, { id: to, lat: b[1], lng: b[0] });
      edges.push({ from, to, widthM: feature.properties.widthM || 2.5 });
    } else if (feature.properties.kind === "barrier" && feature.geometry.type === "Polygon") barriers.push(feature.geometry);
  }
  const stages: Stage[] = siteConfig.stages.map((stage) => ({
    id: stage.id, name: stage.name, lat: stage.lat, lng: stage.lng, capacityHint: stage.capacityHint,
    footprint: stageFootprint(stage.lat, stage.lng),
  }));
  return {
    id: siteConfig.id, name: siteConfig.name,
    bbox: siteConfig.bbox as FestivalSite["bbox"], timezone: siteConfig.timezone,
    h3Resolution: siteConfig.h3Resolution, stages, pathGraph: { nodes: [...nodes.values()], edges }, barriers,
  };
}

export async function loadFestivalDay(input: FestivalDay | SimulationConfig): Promise<FestivalDay> {
  if ("meta" in input && "density" in input) return validateDay(input);
  return runSimulation(input, await loadSite());
}

export function validateDay(day: FestivalDay): FestivalDay {
  if (!day.meta?.source) throw new Error("FestivalDay.meta.source is required");
  if (day.density.some((bucket) => !bucket.h3 || bucket.t % 60_000 !== 0 || bucket.n < 0 || bucket.confidence < 0 || bucket.confidence > 1)) {
    throw new Error("FestivalDay contains an invalid density bucket");
  }
  return day;
}
