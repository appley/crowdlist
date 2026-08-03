import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { isStageId } from "./fixtures";

const ACTIVE_WINDOW_MS = 15 * 60_000;
const CLEANUP_WINDOW_MS = 60 * 60_000;

export const confirm = mutation({
  args: {
    stageId: v.string(),
    anonId: v.string(),
    title: v.string(),
    artists: v.array(v.string()),
    acrid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isStageId(args.stageId)) throw new ConvexError("Unknown stage");
    if (!/^[a-zA-Z0-9_-]{12,80}$/.test(args.anonId)) throw new ConvexError("Invalid anonymous ID");
    const title = args.title.trim();
    const artists = args.artists.map((artist) => artist.trim()).filter(Boolean).slice(0, 6);
    if (!title || title.length > 160 || artists.some((artist) => artist.length > 120)) {
      throw new ConvexError("Invalid song confirmation");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("songConfirmations")
      .withIndex("by_anon_stage", (query) => query.eq("anonId", args.anonId).eq("stageId", args.stageId))
      .unique();
    const values = { title, artists, acrid: args.acrid, createdAt: now };
    if (existing) await ctx.db.patch(existing._id, values);
    else await ctx.db.insert("songConfirmations", { stageId: args.stageId, anonId: args.anonId, ...values });

    const recent = (await ctx.db
      .query("songConfirmations")
      .withIndex("by_stage_created", (query) => query.eq("stageId", args.stageId).gte("createdAt", now - ACTIVE_WINDOW_MS))
      .collect())
      .filter((entry) => entry.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase());
    const stale = (await ctx.db.query("songConfirmations").collect())
      .filter((entry) => entry.createdAt < now - CLEANUP_WINDOW_MS);
    await Promise.all(stale.map((entry) => ctx.db.delete(entry._id)));
    return { confirmations: recent.length, confirmed: recent.length >= 2 };
  },
});
