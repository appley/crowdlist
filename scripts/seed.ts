import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getHttpAdminRepositoryFromEnv } from "../lib/data/http-admin-client";
import { loadLocalEnv } from "./script-env";
import { outsideLandsStages } from "./seed-data";

export async function seed() {
  loadLocalEnv();
  const repository = getHttpAdminRepositoryFromEnv();
  await repository.resetStageOne(outsideLandsStages);
  const snapshot = await repository.getStageOneSnapshot();

  if (snapshot.stages.length !== outsideLandsStages.length) {
    throw new Error(
      `Seed verification failed: expected ${outsideLandsStages.length} stages, got ${snapshot.stages.length}.`,
    );
  }

  const lineupSlots = snapshot.stages.reduce((total, stage) => total + stage.lineup.length, 0);
  console.log(`Seed verified: ${snapshot.stages.length} stages and ${lineupSlots} Friday lineup slots.`);
  return snapshot;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  await seed();
}
