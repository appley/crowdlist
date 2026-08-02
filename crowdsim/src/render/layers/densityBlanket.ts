import { H3HexagonLayer } from "@deck.gl/geo-layers";
import type { DensityBucket } from "../../data/schema";
import { densityColor } from "../colors";

export type RenderBucket = DensityBucket & { interpolatedN: number; interpolatedConfidence: number };

export function densityBlanket(data: RenderBucket[], selectedH3: string | null, onPick: (bucket: RenderBucket) => void) {
  const max = data.reduce((value, bucket) => Math.max(value, bucket.interpolatedN), 1);
  return new H3HexagonLayer<RenderBucket>({
    id: "density-blanket", data, pickable: true, extruded: true, wireframe: false,
    getHexagon: (bucket) => bucket.h3,
    getElevation: (bucket) => 5 + Math.pow(bucket.interpolatedN / max, 0.7) * 165,
    getFillColor: (bucket) => selectedH3 === bucket.h3 ? [214, 255, 79, 255] : densityColor(bucket.interpolatedN, bucket.interpolatedConfidence, max),
    getLineColor: [10, 14, 14, 90], lineWidthMinPixels: 0.4,
    elevationScale: 1, opacity: 0.96, material: { ambient: 0.55, diffuse: 0.7, shininess: 18, specularColor: [40, 40, 40] },
    transitions: { getElevation: 240, getFillColor: 240 },
    onClick: (info) => { if (info.object) onPick(info.object); },
    updateTriggers: { getFillColor: [selectedH3, max], getElevation: [max] },
  });
}
