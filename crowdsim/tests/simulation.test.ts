import assert from "node:assert/strict";
import test from "node:test";
import type { FestivalSite, SimulationConfig } from "../src/data/schema.ts";
import { encodeNdjson, replayBatches, replayToEndpoint } from "../src/data/export.ts";
import { validateDay } from "../src/data/loader.ts";
import { runSimulation } from "../src/sim/run.ts";

const site: FestivalSite = {
  id: "test", name: "Test festival", bbox: [-122.5, 37.76, -122.48, 37.78], timezone: "UTC", h3Resolution: 11, barriers: [],
  stages: [
    { id: "a", name: "A", lat: 37.77, lng: -122.495, capacityHint: 100, footprint: { type: "Polygon", coordinates: [[[-122.496,37.769],[-122.494,37.769],[-122.494,37.771],[-122.496,37.771],[-122.496,37.769]]] } },
    { id: "b", name: "B", lat: 37.77, lng: -122.485, capacityHint: 100, footprint: { type: "Polygon", coordinates: [[[-122.486,37.769],[-122.484,37.769],[-122.484,37.771],[-122.486,37.771],[-122.486,37.769]]] } },
  ],
  pathGraph: { nodes: [{ id: "a", lat: 37.77, lng: -122.495 }, { id: "m", lat: 37.77, lng: -122.49 }, { id: "b", lat: 37.77, lng: -122.485 }], edges: [{ from: "a", to: "m", widthM: 4 }, { from: "m", to: "b", widthM: 4 }] },
};
const config: SimulationConfig = { seed: 42, agentCount: 160, site: "outside-lands", startTime: "2026-08-02T12:00:00Z", endTime: "2026-08-02T13:00:00Z", timestepSeconds: 30, densityIntervalSeconds: 60, kAnonymity: 5 };

test("FestivalDay serialization is byte-identical for the same seed", () => {
  assert.equal(JSON.stringify(runSimulation(config, site)), JSON.stringify(runSimulation(config, site)));
});

test("privacy floor removes every density cell below k", () => {
  const day = runSimulation(config, site);
  assert.ok(day.density.length > 0);
  assert.ok(day.density.every((bucket) => bucket.n >= config.kAnonymity));
  assert.equal(day.meta.source, "simulated");
});

test("NDJSON uses the production ping shape and replay preserves burst counts", () => {
  const day = runSimulation(config, site);
  const first = JSON.parse(encodeNdjson(day, 1).trim());
  assert.deepEqual(Object.keys(first), ["h3", "t", "clientId", "seq"]);
  const replayed = replayBatches(day, 300_000).flatMap((batch) => batch.buckets).reduce((sum, bucket) => sum + bucket.n, 0);
  assert.equal(replayed, day.density.reduce((sum, bucket) => sum + bucket.n, 0));
});

test("compressed replay preserves time spacing and sends each burst to ingest", async () => {
  const day = runSimulation(config, site);
  const waits: number[] = []; const bodies: string[] = [];
  await replayToEndpoint(day, "https://ingest.test/pings", 300_000, async (_input, init) => { bodies.push(String(init?.body)); return new Response(null, { status: 204 }); }, async (ms) => { waits.push(ms); });
  assert.ok(bodies.length > 1);
  assert.equal(waits.reduce((sum, value) => sum + value, 0), 300_000);
  assert.ok(bodies.some((body) => body.trim().split("\n").length > 1));
});

test("the renderer contract accepts measured data without simulation-only fields", () => {
  const simulated = runSimulation(config, site);
  const measured = { ...simulated, meta: { source: "measured" as const, generatedAt: simulated.meta.generatedAt } };
  assert.equal(validateDay(measured), measured);
  assert.equal("seed" in measured.meta, false);
  assert.equal("agentCount" in measured.meta, false);
});
