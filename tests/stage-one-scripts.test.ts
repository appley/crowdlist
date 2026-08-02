import assert from "node:assert/strict";
import test from "node:test";
import type { Presence, Stage } from "../lib/data/types";
import { seed } from "../scripts/seed";
import { simulate } from "../scripts/simulate";

test("seed and simulate scripts write and verify Stage 1 data", async () => {
  let stages: Stage[] = [];
  let presence: Presence[] = [];
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.CROWDLIST_API_URL;
  const originalToken = process.env.CROWDLIST_ADMIN_TOKEN;
  const originalCount = process.env.SIMULATED_PRESENCE_COUNT;

  process.env.CROWDLIST_API_URL = "https://crowdlist.test";
  process.env.CROWDLIST_ADMIN_TOKEN = "test-admin-token";
  process.env.SIMULATED_PRESENCE_COUNT = "96";

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/stage-one") {
      return Response.json({ stages, presence });
    }

    if (new Headers(init?.headers).get("x-crowdlist-admin-token") !== "test-admin-token") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (url.pathname === "/api/admin/seed") {
      const body = JSON.parse(String(init?.body)) as { stages: Stage[] };
      stages = body.stages;
      presence = [];
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/admin/simulate") {
      const body = JSON.parse(String(init?.body)) as { presence: Presence[] };
      presence = body.presence;
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  };

  try {
    await seed();
    await simulate();
    assert.equal(stages.length, 7);
    assert.equal(stages.reduce((sum, stage) => sum + stage.lineup.length, 0), 49);
    assert.equal(presence.length, 96);
    assert.equal(new Set(presence.map((item) => item.stageId)).size, 7);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.CROWDLIST_API_URL;
    else process.env.CROWDLIST_API_URL = originalUrl;
    if (originalToken === undefined) delete process.env.CROWDLIST_ADMIN_TOKEN;
    else process.env.CROWDLIST_ADMIN_TOKEN = originalToken;
    if (originalCount === undefined) delete process.env.SIMULATED_PRESENCE_COUNT;
    else process.env.SIMULATED_PRESENCE_COUNT = originalCount;
  }
});
