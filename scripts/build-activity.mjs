import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runSimulation } from "./crowdsim-engine.mjs";

const root = resolve(import.meta.dirname, "..");
const stagesGeoJson = JSON.parse(readFileSync(resolve(root, "data/ol26/stages.geojson"), "utf8"));
const performanceData = JSON.parse(readFileSync(resolve(root, "data/ol26/performance-snippets.json"), "utf8"));
const pathGraph = JSON.parse(readFileSync(resolve(root, "data/ol26/path-graph.json"), "utf8"));
const outputPath = resolve(root, "data/ol26/activity-frames.json");

const SEED = 42;
const AGENT_COUNT = 8_000;
const K_ANONYMITY = 5;
const H3_RESOLUTION = 11;
const FRAME_COUNT = 24;
const FRAME_DURATION_MS = 3_000;
const FRAME_START = Date.parse("2026-08-07T18:45:00-07:00");
const SIMULATION_START = "2026-08-07T12:00:00-07:00";
const SIMULATION_END = new Date(FRAME_START + (FRAME_COUNT - 1) * 60_000).toISOString();
const CAPACITY_HINT = {
  "lands-end": 32_000,
  "twin-peaks": 19_000,
  sutro: 12_000,
  panhandle: 7_000,
  soma: 8_500,
  dolores: 5_000,
  "duboce-triangle": 4_000,
};

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function distanceMeters(left, right) {
  const latitude = ((left[1] + right[1]) / 2) * Math.PI / 180;
  return Math.hypot(
    (right[0] - left[0]) * 111_320 * Math.cos(latitude),
    (right[1] - left[1]) * 110_540,
  );
}

function positionAlongRoute(route, progress) {
  const lengths = [];
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    const length = distanceMeters(route[index - 1], route[index]);
    lengths.push(length);
    total += length;
  }
  let cursor = Math.min(1, Math.max(0, progress)) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (cursor <= lengths[index]) {
      const amount = lengths[index] ? cursor / lengths[index] : 0;
      return [
        route[index][0] + (route[index + 1][0] - route[index][0]) * amount,
        route[index][1] + (route[index + 1][1] - route[index][1]) * amount,
      ];
    }
    cursor -= lengths[index];
  }
  return route.at(-1);
}

const stages = stagesGeoJson.features.map((feature) => ({
  id: feature.properties.id,
  name: feature.properties.name,
  lng: feature.geometry.coordinates[0],
  lat: feature.geometry.coordinates[1],
  capacityHint: CAPACITY_HINT[feature.properties.id] ?? 6_000,
}));
const stageIndexById = new Map(stages.map((stage, index) => [stage.id, index]));
const sets = stages.flatMap((stage) => {
  const performances = performanceData.stages[stage.id] ?? [];
  return performances.map(([artistName, start, end], index) => ({
    id: `${stage.id}-${index}`,
    stageId: stage.id,
    artistName,
    startsAt: Date.parse(`2026-08-07T${start}:00-07:00`),
    endsAt: Date.parse(`2026-08-07T${end}:00-07:00`),
    popularity: round(0.28 + (performances.length === 1 ? 0.5 : index / (performances.length - 1) * 0.62), 3),
  }));
});
const site = {
  id: "outside-lands-2026",
  h3Resolution: H3_RESOLUTION,
  stages,
  pathGraph: { nodes: pathGraph.nodes, edges: pathGraph.edges },
};

const simulation = runSimulation({
  config: {
    seed: SEED,
    agentCount: AGENT_COUNT,
    startTime: SIMULATION_START,
    endTime: SIMULATION_END,
    densityIntervalSeconds: 60,
    kAnonymity: K_ANONYMITY,
  },
  site,
  sets,
});

const frameTimes = Array.from({ length: FRAME_COUNT }, (_, index) => FRAME_START + index * 60_000);
const densityByTime = new Map(frameTimes.map((time) => [time, new Map()]));
for (const bucket of simulation.density) {
  const frame = densityByTime.get(bucket.t);
  if (frame) frame.set(bucket.h3, bucket);
}
const h3Cells = [...new Set([...densityByTime.values()].flatMap((frame) => [...frame.keys()]))].sort();
const maxContributors = Math.max(
  K_ANONYMITY,
  ...[...densityByTime.values()].flatMap((frame) => [...frame.values()].map((bucket) => bucket.n)),
);

const relevantMigrations = simulation.migrations.filter((migration) =>
  migration.time >= FRAME_START - 9 * 60_000 && migration.time <= frameTimes.at(-1)
);
const pairTotals = new Map();
for (const migration of relevantMigrations) {
  const key = `${migration.from}:${migration.to}`;
  pairTotals.set(key, (pairTotals.get(key) ?? 0) + migration.count);
}
const migrationPairs = [...pairTotals.entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .slice(0, 14)
  .map(([key]) => key.split(":").map(Number));

function activeSet(stageId, time) {
  return sets.find((set) => set.stageId === stageId && set.startsAt <= time && set.endsAt > time);
}

function stageCounts(frame) {
  return stages.map((stage) => {
    let contributors = 0;
    for (const bucket of frame.values()) {
      const [lat, lng] = simulation.cellToLatLng(bucket.h3);
      if (distanceMeters([lng, lat], [stage.lng, stage.lat]) <= 175) contributors += bucket.n;
    }
    return contributors;
  });
}

const countsByFrame = frameTimes.map((time) => stageCounts(densityByTime.get(time)));

function crowdLevel(value) {
  if (value < 0.26) return "easy";
  if (value < 0.52) return "comfortable";
  if (value < 0.79) return "busy";
  return "packed";
}

function energyLevel(popularity, relativeCrowd) {
  const value = popularity * 0.66 + relativeCrowd * 0.34;
  if (value < 0.42) return "low";
  if (value < 0.72) return "medium";
  return "high";
}

function densityPoints(frame) {
  return h3Cells.map((h3) => {
    const bucket = frame.get(h3);
    const [lat, lng] = simulation.cellToLatLng(h3);
    if (!bucket) return [round(lng), round(lat), 0, 0];
    const weight = 0.12 + Math.log1p(bucket.n) / Math.log1p(maxContributors) * 1.03;
    return [round(lng), round(lat), round(weight, 3), bucket.n];
  });
}

function migrationPoints(time) {
  return migrationPairs.flatMap(([from, to]) => {
    const migration = relevantMigrations
      .filter((candidate) => candidate.from === from && candidate.to === to && candidate.time <= time)
      .sort((left, right) => right.time - left.time)[0];
    return Array.from({ length: 3 }, (_, particle) => {
      if (!migration || time - migration.time > 9 * 60_000) return [stages[from].lng, stages[from].lat, 0, 0];
      const progress = (time - migration.time) / (9 * 60_000) - particle * 0.075;
      if (progress < 0 || progress > 1) return [stages[from].lng, stages[from].lat, 0, 0];
      const [lng, lat] = positionAlongRoute(simulation.routes[from][to], progress);
      return [
        round(lng),
        round(lat),
        round(Math.min(1.25, 0.25 + migration.count / 90), 3),
        Math.max(K_ANONYMITY, Math.round(migration.count / 3)),
      ];
    });
  });
}

const frames = frameTimes.map((time, frameIndex) => {
  const counts = countsByFrame[frameIndex];
  const maximum = Math.max(1, ...counts);
  const previous = countsByFrame[Math.max(0, frameIndex - 1)];
  return {
    at: new Date(time).toISOString(),
    points: [...densityPoints(densityByTime.get(time)), ...migrationPoints(time)],
    stages: stages.map((stage, stageIndex) => {
      const relativeCrowd = counts[stageIndex] / maximum;
      const delta = counts[stageIndex] - previous[stageIndex];
      const set = activeSet(stage.id, time);
      return {
        stageId: stage.id,
        crowd: crowdLevel(relativeCrowd),
        energy: energyLevel(set?.popularity ?? 0.18, relativeCrowd),
        trend: delta > Math.max(8, counts[stageIndex] * 0.08)
          ? "rising"
          : delta < -Math.max(8, counts[stageIndex] * 0.08)
            ? "falling"
            : "steady",
      };
    }),
  };
});

const portrait = {
  meta: {
    source: "simulated",
    label: "CrowdSim estimate · not measurement",
    engine: "krish-dev-crowdsim-agent-h3",
    sourceCommit: "16dfaae",
    seed: SEED,
    agentCount: AGENT_COUNT,
    frameDurationMs: FRAME_DURATION_MS,
    kAnonymity: K_ANONYMITY,
    h3Resolution: H3_RESOLUTION,
    graphNodes: pathGraph.nodes.length,
    graphEdges: pathGraph.edges.length,
    generatedAt: "2026-08-03T00:00:00.000Z",
  },
  frames,
};
const serialized = `${JSON.stringify(portrait)}\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8");
  if (current !== serialized) {
    console.error("CrowdSim portrait is stale. Run `bun run activity:build`.");
    process.exit(1);
  }
  console.log(
    `CrowdSim portrait verified: ${FRAME_COUNT} frames, ${h3Cells.length} H3 cells, ${Buffer.byteLength(serialized)} bytes.`,
  );
} else {
  writeFileSync(outputPath, serialized);
  console.log(
    `Wrote CrowdSim portrait: ${FRAME_COUNT} frames, ${h3Cells.length} H3 cells, ${Buffer.byteLength(serialized)} bytes.`,
  );
}
