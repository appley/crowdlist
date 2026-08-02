import { interpolateHcl } from "d3-interpolate";
import { scaleSequential } from "d3-scale";

const densityRamp = scaleSequential(interpolateHcl("#49656b", "#f08a52")).domain([0, 1]).clamp(true);

export function densityColor(n: number, confidence: number, max: number): [number, number, number, number] {
  const value = Math.sqrt(n / Math.max(1, max));
  const color = densityRamp(value);
  const match = color.match(/\d+(?:\.\d+)?/g)?.map(Number) || [90, 120, 124];
  const gray = (match[0] + match[1] + match[2]) / 3;
  const saturation = 0.28 + confidence * 0.72;
  return [
    Math.round(gray + (match[0] - gray) * saturation),
    Math.round(gray + (match[1] - gray) * saturation),
    Math.round(gray + (match[2] - gray) * saturation),
    Math.round(70 + confidence * 175),
  ];
}

export const eventColors: Record<string, [number, number, number, number]> = {
  set_start: [168, 217, 191, 230], set_end: [112, 123, 126, 220], density_peak: [240, 138, 82, 240],
  song_confirmed: [214, 255, 79, 240], mass_migration: [216, 184, 111, 230],
};
