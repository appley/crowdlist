import { internalMutation } from "./_generated/server";
import { DEMO_PULSES } from "./fixtures";

export const reset = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const report of await ctx.db.query("reports").collect()) await ctx.db.delete(report._id);
    for (const pulse of await ctx.db.query("pulses").collect()) await ctx.db.delete(pulse._id);
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
    return { reset: true };
  },
});
