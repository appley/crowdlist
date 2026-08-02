import type {
  CrowdListRepository,
  Presence,
  SimulatedPresenceInput,
  Stage,
  StageOneSnapshot,
} from "./types";
import { getCrowdListRuntimeEnv } from "./runtime-env";

type StageRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lineup_json: string;
};

type PresenceRow = {
  user_id: string;
  stage_id: string;
  lat: number;
  lng: number;
  updated_at: number;
};

function database() {
  return getCrowdListRuntimeEnv().DB;
}

export class D1CrowdListRepository implements CrowdListRepository {
  async getStageOneSnapshot(): Promise<StageOneSnapshot> {
    const db = database();
    const [stageResult, presenceResult] = await Promise.all([
      db.prepare("SELECT id, name, lat, lng, lineup_json FROM stages ORDER BY name").all<StageRow>(),
      db
        .prepare(
          "SELECT user_id, stage_id, lat, lng, updated_at FROM presence ORDER BY stage_id, user_id",
        )
        .all<PresenceRow>(),
    ]);

    const stages: Stage[] = stageResult.results.map((row) => ({
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      lineup: JSON.parse(row.lineup_json),
    }));

    const presence: Presence[] = presenceResult.results.map((row) => ({
      userId: row.user_id,
      stageId: row.stage_id,
      lat: row.lat,
      lng: row.lng,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));

    return { stages, presence };
  }

  async resetStageOne(stages: Stage[]): Promise<void> {
    const db = database();
    await db.batch([
      db.prepare("DELETE FROM setlist_items"),
      db.prepare("DELETE FROM proposals"),
      db.prepare("DELETE FROM now_playing"),
      db.prepare("DELETE FROM presence"),
      db.prepare("DELETE FROM stages"),
    ]);

    if (stages.length === 0) return;

    await db.batch(
      stages.map((stage) =>
        db
          .prepare(
            "INSERT INTO stages (id, name, lat, lng, lineup_json) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(stage.id, stage.name, stage.lat, stage.lng, JSON.stringify(stage.lineup)),
      ),
    );
  }

  async replacePresence(presence: SimulatedPresenceInput[]): Promise<void> {
    const db = database();
    await db.prepare("DELETE FROM presence").run();
    if (presence.length === 0) return;

    await db.batch(
      presence.map((item) =>
        db
          .prepare(
            "INSERT INTO presence (user_id, stage_id, lat, lng, updated_at) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            item.userId,
            item.stageId,
            item.lat,
            item.lng,
            new Date(item.updatedAt).getTime(),
          ),
      ),
    );
  }
}

export function getCrowdListRepository(): CrowdListRepository {
  return new D1CrowdListRepository();
}
