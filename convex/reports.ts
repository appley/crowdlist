import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { isStageId } from "./fixtures";
import { rebuildStagePulse } from "./pulses";

const crowd = v.union(v.literal("easy"), v.literal("comfortable"), v.literal("busy"), v.literal("packed"));
const energy = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
const trend = v.union(v.literal("rising"), v.literal("steady"), v.literal("falling"));

export const submit = mutation({
  args: {
    stageId: v.string(),
    crowd,
    energy,
    trend,
    text: v.optional(v.string()),
    anonId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isStageId(args.stageId)) throw new ConvexError("Unknown stage");
    if (!/^[a-zA-Z0-9_-]{12,80}$/.test(args.anonId)) throw new ConvexError("Invalid anonymous ID");
    const text = args.text?.trim();
    if (text && text.length > 140) throw new ConvexError("Report details must be 140 characters or less");

    const now = Date.now();
    const recent = await ctx.db
      .query("reports")
      .withIndex("by_anon_created", (q) => q.eq("anonId", args.anonId))
      .order("desc")
      .take(5);
    if (recent.length === 5 && recent[4].createdAt > now - 5 * 60_000) {
      throw new ConvexError("Please wait a few minutes before adding another pulse");
    }

    const reportId = await ctx.db.insert("reports", {
      stageId: args.stageId,
      crowd: args.crowd,
      energy: args.energy,
      trend: args.trend,
      anonId: args.anonId,
      hasText: Boolean(text),
      createdAt: now,
    });
    await rebuildStagePulse(ctx, args.stageId);

    if (text) {
      await ctx.scheduler.runAfter(0, internal.openai.parseReport, {
        reportId,
        text,
        selectedCrowd: args.crowd,
        selectedEnergy: args.energy,
      });
    }
    return { accepted: true };
  },
});

export const applyParsedReport = internalMutation({
  args: {
    reportId: v.id("reports"),
    crowd,
    energy,
    trend,
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return;
    await ctx.db.patch(args.reportId, {
      parsedCrowd: args.crowd,
      parsedEnergy: args.energy,
      parsedTrend: args.trend,
      summary: args.summary.slice(0, 100),
    });
    await rebuildStagePulse(ctx, report.stageId);
  },
});
