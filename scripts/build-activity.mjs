import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const stageGeoJson = JSON.parse(readFileSync(resolve(root, "data/ol26/stages.geojson"), "utf8"));
const pulseFixtures = JSON.parse(readFileSync(resolve(root, "data/ol26/demo-pulses.json"), "utf8"));
const outputPath = resolve(root, "data/ol26/activity-frames.json");

const FRAME_COUNT = 24;
const FRAME_DURATION_MS = 3_000;
const START_TIME = Date.parse("2026-08-07T18:45:00-07:00");
const SEED = 42;
const CROWD_VALUE = { easy: 1, comfortable: 2, busy: 3, packed: 4 };
const ENERGY_VALUE = { low: 1, medium: 2, high: 3 };

const stages = stageGeoJson.features.map((feature) => ({
  id: feature.properties.id,
  name: feature.properties.name,
  coordinates: feature.geometry.coordinates,
}));
const stageById = new Map(stages.map((stage) => [stage.id, stage]));
const pulseByStage = new Map(pulseFixtures.map((pulse) => [pulse.stageId, pulse]));

// These corridors follow the festival-facing park paths visible in the shipped
// OSM basemap. They are build-time inputs, not claims about measured footfall.
const routes = [
  ["lands-end", "sutro", 0.34, 0.18, 1.0],
  ["lands-end", "dolores", -0.22, 0.62, 0.75],
  ["dolores", "panhandle", 0.28, 0.37, 0.9],
  ["sutro", "duboce-triangle", -0.24, 0.83, 1.15],
  ["panhandle", "duboce-triangle", 0.2, 0.08, 0.82],
  ["duboce-triangle", "soma", -0.18, 0.48, 1.25],
  ["soma", "twin-peaks", 0.22, 0.72, 0.95],
];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function hash(seed, ...values) {
  let state = seed >>> 0;
  for (const value of values) {
    state ^= Math.imul(Number(value) + 0x9e3779b9, 0x85ebca6b);
    state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  }
  return (state ^ (state >>> 16)) >>> 0;
}

function unit(seed, ...values) {
  return hash(seed, ...values) / 0xffffffff;
}

function crowdLevel(value) {
  if (value < 1.55) return "easy";
  if (value < 2.55) return "comfortable";
  if (value < 3.45) return "busy";
  return "packed";
}

function energyLevel(value) {
  if (value < 1.5) return "low";
  if (value < 2.5) return "medium";
  return "high";
}

function corridorPoint(from, to, progress, bend) {
  const [fromLng, fromLat] = from.coordinates;
  const [toLng, toLat] = to.coordinates;
  const dx = toLng - fromLng;
  const dy = toLat - fromLat;
  const length = Math.hypot(dx, dy) || 1;
  const arc = Math.sin(progress * Math.PI) * bend * 0.00115;
  return [
    round(fromLng + dx * progress + (-dy / length) * arc),
    round(fromLat + dy * progress + (dx / length) * arc),
  ];
}

function frameAt(frameIndex) {
  const phase = (frameIndex / FRAME_COUNT) * Math.PI * 2;
  const points = [];
  const stageStates = [];

  stages.forEach((stage, stageIndex) => {
    const fixture = pulseByStage.get(stage.id);
    const baseCrowd = CROWD_VALUE[fixture?.crowd] ?? 2;
    const baseEnergy = ENERGY_VALUE[fixture?.energy] ?? 2;
    const stagePhase = phase + stageIndex * 0.91;
    const crowdValue = clamp(
      baseCrowd + Math.sin(stagePhase) * 0.48 + Math.sin(stagePhase * 2.2 + 0.4) * 0.16,
      1,
      4,
    );
    const energyValue = clamp(baseEnergy + Math.sin(stagePhase + 0.7) * 0.36, 1, 3);
    const slope = Math.cos(stagePhase) + Math.cos(stagePhase * 2.2 + 0.4) * 0.35;
    const trend = slope > 0.27 ? "rising" : slope < -0.27 ? "falling" : "steady";
    const contributors = Math.max(5, Math.round(7 + crowdValue * 10));

    stageStates.push({
      stageId: stage.id,
      crowd: crowdLevel(crowdValue),
      energy: energyLevel(energyValue),
      trend,
    });
    points.push([
      round(stage.coordinates[0]),
      round(stage.coordinates[1]),
      round(0.46 + crowdValue * 0.17, 3),
      contributors,
    ]);

    for (let ringIndex = 0; ringIndex < 6; ringIndex += 1) {
      const angle =
        (ringIndex / 6) * Math.PI * 2 + phase * (0.22 + stageIndex * 0.012) + unit(SEED, stageIndex, ringIndex) * 0.35;
      const radius = 0.00034 + unit(SEED + 1, stageIndex, ringIndex) * 0.00058;
      const longitudeScale = Math.cos((stage.coordinates[1] * Math.PI) / 180);
      points.push([
        round(stage.coordinates[0] + (Math.cos(angle) * radius) / longitudeScale),
        round(stage.coordinates[1] + Math.sin(angle) * radius),
        round(clamp(0.12 + crowdValue * 0.16 - ringIndex * 0.008, 0.12, 0.8), 3),
        Math.max(5, Math.round(contributors * (0.58 + unit(SEED + 2, stageIndex, ringIndex) * 0.22))),
      ]);
    }
  });

  routes.forEach(([fromId, toId, bend, offset, speed], routeIndex) => {
    const from = stageById.get(fromId);
    const to = stageById.get(toId);
    for (let pointIndex = 0; pointIndex < 6; pointIndex += 1) {
      const progress = (pointIndex / 6 + frameIndex / FRAME_COUNT * speed + offset) % 1;
      const wave = 0.5 + 0.5 * Math.sin(phase + routeIndex * 0.73 + pointIndex * 0.55);
      const contributors = Math.max(5, Math.round(5 + wave * 15));
      const [longitude, latitude] = corridorPoint(from, to, progress, bend);
      points.push([
        longitude,
        latitude,
        round(0.17 + wave * 0.32, 3),
        contributors,
      ]);
    }
  });

  return {
    at: new Date(START_TIME + frameIndex * 60_000).toISOString(),
    points,
    stages: stageStates,
  };
}

const portrait = {
  meta: {
    source: "simulated",
    label: "Simulated festival baseline",
    seed: SEED,
    frameDurationMs: FRAME_DURATION_MS,
    kAnonymity: 5,
    generatedAt: "2026-08-02T23:59:00.000Z",
  },
  frames: Array.from({ length: FRAME_COUNT }, (_, index) => frameAt(index)),
};
const serialized = `${JSON.stringify(portrait)}\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8");
  if (current !== serialized) {
    console.error("Activity frames are stale. Run `npm run activity:build`.");
    process.exit(1);
  }
  console.log(`Activity portrait verified: ${FRAME_COUNT} deterministic frames, ${Buffer.byteLength(serialized)} bytes.`);
} else {
  writeFileSync(outputPath, serialized);
  console.log(`Wrote ${FRAME_COUNT} deterministic frames to ${outputPath} (${Buffer.byteLength(serialized)} bytes).`);
}
