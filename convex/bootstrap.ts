import { mutation, query } from "./_generated/server";
import { DEMO_PULSES } from "./fixtures";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const pulses = await ctx.db.query("pulses").collect();
    if (pulses.length === 0) return null;
    const now = Date.now();
    const activePresence = (await ctx.db.query("presence").collect())
      .filter((entry) => entry.updatedAt >= now - 2 * 60_000);
    const recentSongConfirmations = (await ctx.db.query("songConfirmations").collect())
      .filter((entry) => entry.createdAt >= now - 15 * 60_000);
    const cells = new Map<string, {
      cellId: string;
      longitude: number;
      latitude: number;
      count: number;
    }>();
    for (const entry of activePresence) {
      const existing = cells.get(entry.cellId);
      if (existing) existing.count += 1;
      else cells.set(entry.cellId, {
        cellId: entry.cellId,
        longitude: entry.longitude,
        latitude: entry.latitude,
        count: 1,
      });
    }
    const songs = new Map<string, {
      stageId: string;
      title: string;
      artists: string[];
      confirmations: number;
      updatedAt: number;
    }>();
    for (const entry of recentSongConfirmations) {
      const key = `${entry.stageId}:${entry.title.trim().toLocaleLowerCase()}`;
      const existing = songs.get(key);
      if (existing) {
        existing.confirmations += 1;
        existing.updatedAt = Math.max(existing.updatedAt, entry.createdAt);
      } else {
        songs.set(key, {
          stageId: entry.stageId,
          title: entry.title,
          artists: entry.artists,
          confirmations: 1,
          updatedAt: entry.createdAt,
        });
      }
    }
    const songSignals = [...songs.values()]
      .sort((left, right) => right.confirmations - left.confirmations || right.updatedAt - left.updatedAt)
      .filter((signal, index, all) => all.findIndex((candidate) => candidate.stageId === signal.stageId) === index)
      .map((signal) => ({ ...signal, confirmed: signal.confirmations >= 2 }));
    return {
      pulses: pulses.map(({ _id, _creationTime, ...pulse }) => ({
        ...pulse,
        freshnessMinutes: Math.max(0, Math.floor((now - pulse.updatedAt) / 60_000)),
      })),
      presenceCells: [...cells.values()],
      songSignals,
    };
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("pulses").first();
    if (existing) return { seeded: false };
    const now = Date.now();
    for (const pulse of DEMO_PULSES) {
      const { freshnessMinutes, ...values } = pulse;
      await ctx.db.insert("pulses", {
        ...values,
        baselineCount: pulse.reportCount,
        updatedAt: now - freshnessMinutes * 60_000,
        source: "seeded-demo",
      });
    }
    return { seeded: true };
  },
});
