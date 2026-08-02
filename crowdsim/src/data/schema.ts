/** Fixed site description. Authored once per festival, not generated. */
export interface FestivalSite {
  id: string;
  name: string;
  bbox: [west: number, south: number, east: number, north: number];
  timezone: string;
  h3Resolution: number;
  stages: Stage[];
  pathGraph: PathGraph;
  barriers: GeoJSON.Polygon[];
}

export interface Stage {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacityHint: number;
  footprint: GeoJSON.Polygon;
}

export interface PathGraph {
  nodes: { id: string; lat: number; lng: number }[];
  edges: { from: string; to: string; widthM: number }[];
}

export interface Set {
  id: string;
  stageId: string;
  artistName: string;
  mbid?: string;
  startsAt: number;
  endsAt: number;
  popularity: number;
}

export interface DensityBucket {
  h3: string;
  t: number;
  n: number;
  confidence: number;
}

export interface FestivalEvent {
  t: number;
  kind: "set_start" | "set_end" | "density_peak" | "song_confirmed" | "mass_migration";
  stageId?: string;
  label: string;
  magnitude?: number;
}

export interface FestivalDay {
  site: FestivalSite;
  sets: Set[];
  density: DensityBucket[];
  events: FestivalEvent[];
  meta: {
    source: "simulated" | "measured" | "hybrid";
    seed?: number;
    generatedAt: number;
    agentCount?: number;
  };
}

export interface SimulationConfig {
  seed: number;
  agentCount: number;
  site: "outside-lands";
  startTime: string;
  endTime: string;
  timestepSeconds: number;
  densityIntervalSeconds: number;
  kAnonymity: number;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 42,
  agentCount: 8000,
  site: "outside-lands",
  startTime: "2026-08-02T12:00:00-07:00",
  endTime: "2026-08-02T22:00:00-07:00",
  timestepSeconds: 30,
  densityIntervalSeconds: 60,
  kAnonymity: 5,
};
