import type { FeatureCollection, Polygon } from "geojson";
import zonesText from "../../data/ol26/zones.geojson?raw";

export interface ZoneProperties {
  id: string;
  name: string;
  fill: string;
  ink: string;
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

/**
 * Longest-axis angle of a ring, in screen degrees, so a zone label can lie
 * along its meadow the way the printed map sets its type.
 */
function labelAngle(ring: [number, number][]): number {
  let longest = 0;
  let angle = 0;
  for (let i = 0; i < ring.length; i += 1) {
    for (let j = i + 1; j < ring.length; j += 1) {
      const dx = (ring[j][0] - ring[i][0]) * Math.cos((ring[i][1] * Math.PI) / 180);
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
  return angle;
}

export const ZONE_LABELS: ZoneLabel[] = ZONES_GEOJSON.features.map((feature) => {
  const ring = feature.geometry.coordinates[0] as [number, number][];
  const points = ring.slice(0, -1);
  const center: [number, number] = [
    points.reduce((total, point) => total + point[0], 0) / points.length,
    points.reduce((total, point) => total + point[1], 0) / points.length,
  ];
  return {
    id: feature.properties.id,
    name: feature.properties.name,
    ink: feature.properties.ink,
    center,
    angle: labelAngle(points),
  };
});

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
