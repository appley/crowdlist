import assert from "node:assert/strict";
import test from "node:test";
import {
  countPresenceByStage,
  getFeaturedLineupSlot,
  getFreshPresence,
} from "../mobile/src/data/crowd";
import type { Presence } from "../mobile/src/data/types";

const now = Date.parse("2026-08-07T20:00:00.000Z");
const presence: Presence[] = [
  { userId: "fresh-a", stageId: "lands-end", lat: 1, lng: 1, updatedAt: "2026-08-07T19:59:00.000Z" },
  { userId: "fresh-b", stageId: "lands-end", lat: 1, lng: 1, updatedAt: "2026-08-07T19:58:00.000Z" },
  { userId: "stale", stageId: "sutro", lat: 1, lng: 1, updatedAt: "2026-08-07T19:57:59.999Z" },
  { userId: "future", stageId: "sutro", lat: 1, lng: 1, updatedAt: "2026-08-07T20:00:01.000Z" },
];

test("heatmap counts only heartbeats in the two-minute crowd window", () => {
  const fresh = getFreshPresence(presence, now);
  const counts = countPresenceByStage(fresh);

  assert.deepEqual(fresh.map((item) => item.userId), ["fresh-a", "fresh-b"]);
  assert.equal(counts.get("lands-end"), 2);
  assert.equal(counts.has("sutro"), false);
});

test("stage markers feature the current artist, then the next artist", () => {
  const lineup = [
    { artist: "Opening Band", startTs: "2026-08-07T19:00:00.000Z", endTs: "2026-08-07T19:45:00.000Z" },
    { artist: "Headliner", startTs: "2026-08-07T20:00:00.000Z", endTs: "2026-08-07T21:00:00.000Z" },
  ];

  assert.deepEqual(getFeaturedLineupSlot(lineup, Date.parse("2026-08-07T18:00:00.000Z")), {
    artist: "Opening Band",
    status: "NEXT",
  });
  assert.deepEqual(getFeaturedLineupSlot(lineup, Date.parse("2026-08-07T20:30:00.000Z")), {
    artist: "Headliner",
    status: "NOW",
  });
});
