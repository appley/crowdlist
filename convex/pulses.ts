import type { MutationCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { aggregateReports } from "./pulseModel";

export async function rebuildStagePulse(ctx: MutationCtx, stageId: string) {
  const reports = await ctx.db
    .query("reports")
    .withIndex("by_stage_created", (q) => q.eq("stageId", stageId))
    .order("desc")
    .take(30);
  if (reports.length === 0) return;

  const aggregate = aggregateReports(reports);
  const pulse = await ctx.db
    .query("pulses")
    .withIndex("by_stage", (q) => q.eq("stageId", stageId))
    .unique();

  // Fan reports drive the displayed levels, but the seeded baseline keeps
  // contributing its count so a fresh report never shrinks the crowd.
  const baselineCount = pulse?.baselineCount ?? 0;
  const patch = {
    ...aggregate,
    reportCount: baselineCount + aggregate.reportCount,
    source: (baselineCount > 0 ? "mixed" : "community") as "mixed" | "community",
  };
  if (pulse) await ctx.db.patch(pulse._id, patch);
  else await ctx.db.insert("pulses", { stageId, ...patch });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pulses = await ctx.db.query("pulses").collect();
    return pulses.map(({ _id, _creationTime, ...pulse }) => ({
      ...pulse,
      freshnessMinutes: Math.max(0, Math.floor((now - pulse.updatedAt) / 60_000)),
    }));
  },
});
