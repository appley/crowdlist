import type { LineupSlot, Presence } from "./types";

export const CROWD_WINDOW_MS = 2 * 60 * 1000;

export function getFreshPresence(
  presence: Presence[],
  nowMs = Date.now(),
): Presence[] {
  const cutoff = nowMs - CROWD_WINDOW_MS;
  return presence.filter((item) => {
    const updatedAt = Date.parse(item.updatedAt);
    return Number.isFinite(updatedAt) && updatedAt >= cutoff && updatedAt <= nowMs;
  });
}

export function countPresenceByStage(presence: Presence[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of presence) {
    counts.set(item.stageId, (counts.get(item.stageId) ?? 0) + 1);
  }
  return counts;
}

export function getFeaturedLineupSlot(lineup: LineupSlot[], nowMs: number) {
  const current = lineup.find(
    (slot) => Date.parse(slot.startTs) <= nowMs && Date.parse(slot.endTs) >= nowMs,
  );
  if (current) return { artist: current.artist, status: "NOW" as const };

  const next = lineup.find((slot) => Date.parse(slot.startTs) > nowMs);
  return next ? { artist: next.artist, status: "NEXT" as const } : null;
}
