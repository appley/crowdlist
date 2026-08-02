import type { FeatureCollection, Polygon } from "geojson";
import zonesText from "../../data/ol26/zones.geojson?raw";

export interface ZoneProperties {
  id: string;
  name: string;
  fill: string;
  ink: string;
  /** Anchor chosen by scripts/build-zones.mjs to clear the stage pills. */
  label: [number, number];
  angle: number;
  authored?: boolean;
}

export const ZONES_GEOJSON = JSON.parse(zonesText) as FeatureCollection<Polygon, ZoneProperties>;

export interface ZoneLabel {
  id: string;
  name: string;
  ink: string;
  center: [number, number];
  angle: number;
}

export const ZONE_LABELS: ZoneLabel[] = ZONES_GEOJSON.features.map((feature) => ({
  id: feature.properties.id,
  name: feature.properties.name,
  ink: feature.properties.ink,
  center: feature.properties.label,
  angle: feature.properties.angle,
}));

/** Bounding box of the festival zones, used to frame the camera. */
export const GROUNDS_BOUNDS: [[number, number], [number, number]] = (() => {
  const points = ZONES_GEOJSON.features.flatMap(
    (feature) => feature.geometry.coordinates[0] as [number, number][],
  );
  const lons = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
})();
