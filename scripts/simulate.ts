import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getHttpAdminRepositoryFromEnv } from "../lib/data/http-admin-client";
import type { SimulatedPresenceInput, Stage } from "../lib/data/types";
import { loadLocalEnv } from "./script-env";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function jitterNearStage(stage: Stage, random: () => number) {
  const radiusMeters = 18 + random() * 95;
  const angle = random() * Math.PI * 2;
  const latOffset = (Math.cos(angle) * radiusMeters) / 111_320;
  const lngOffset =
    (Math.sin(angle) * radiusMeters) /
    (111_320 * Math.cos((stage.lat * Math.PI) / 180));
  return { lat: stage.lat + latOffset, lng: stage.lng + lngOffset };
}

export async function simulate() {
  loadLocalEnv();
  const repository = getHttpAdminRepositoryFromEnv();
  const snapshot = await repository.getStageOneSnapshot();
  if (snapshot.stages.length === 0) {
    throw new Error("No stages found. Run npm run seed first.");
  }

  const total = Number.parseInt(process.env.SIMULATED_PRESENCE_COUNT ?? "96", 10);
  const random = seededRandom(Number.parseInt(process.env.SIMULATION_SEED ?? "20260807", 10));
  const weights = [0.3, 0.2, 0.15, 0.12, 0.1, 0.08, 0.05];
  const weightedStages = snapshot.stages.map((stage, index) => ({
    stage,
    weight: weights[index] ?? 1 / snapshot.stages.length,
  }));
  const weightTotal = weightedStages.reduce((sum, item) => sum + item.weight, 0);

  const chooseStage = () => {
    let cursor = random() * weightTotal;
    for (const item of weightedStages) {
      cursor -= item.weight;
      if (cursor <= 0) return item.stage;
    }
    return weightedStages.at(-1)!.stage;
  };

  const now = Date.now();
  const presence: SimulatedPresenceInput[] = Array.from({ length: total }, (_, index) => {
    const stage = chooseStage();
    const point = jitterNearStage(stage, random);
    return {
      userId: `demo-user-${String(index + 1).padStart(3, "0")}`,
      stageId: stage.id,
      ...point,
      updatedAt: new Date(now - Math.floor(random() * 90_000)).toISOString(),
    };
  });

  await repository.replacePresence(presence);
  const verified = await repository.getStageOneSnapshot();
  if (verified.presence.length !== total) {
    throw new Error(
      `Simulation verification failed: expected ${total} presence rows, got ${verified.presence.length}.`,
    );
  }

  console.log(`Simulation verified: ${verified.presence.length} fresh presence records across ${verified.stages.length} stages.`);
  return verified;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  await simulate();
}
