import type { FeatureCollection, Point } from "geojson";
import festival from "../../data/ol26/festival.json";
import pulseFixtures from "../../data/ol26/demo-pulses.json";
import performanceFixtures from "../../data/ol26/performance-snippets.json";
import stageGeoJsonText from "../../data/ol26/stages.geojson?raw";
import type { Performance, Stage, StagePulse } from "../types";

interface StageProperties {
  id: string;
  name: string;
  zone: string;
  accent: string;
}

type StageFeatureCollection = FeatureCollection<Point, StageProperties>;

export const FESTIVAL = festival;
export const DEMO_NOW = new Date(festival.demoNow);
export const MAP_COORDINATES = festival.map.coordinates as [number, number][];
export const DEMO_LOCATION = festival.demoLocation as [number, number];

export const STAGE_GEOJSON = JSON.parse(stageGeoJsonText) as StageFeatureCollection;

export const STAGES: Stage[] = STAGE_GEOJSON.features.map((feature) => ({
  ...feature.properties,
  coordinates: feature.geometry.coordinates as [number, number],
}));

export const INITIAL_PULSES = pulseFixtures as StagePulse[];

export const PERFORMANCE_FIXTURES = performanceFixtures.stages as unknown as Record<
  string,
  [string, string, string][]
>;

export function performancesFor(stageId: string): Performance[] {
  return (PERFORMANCE_FIXTURES[stageId] ?? []).map(([name, start, end]) => ({
    name,
    start,
    end,
  }));
}
