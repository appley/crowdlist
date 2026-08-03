import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

const GRID_DEGREES = 0.0006;
const ACTIVE_WINDOW_MS = 2 * 60_000;
const CLEANUP_WINDOW_MS = 10 * 60_000;
const FESTIVAL_BOUNDS = {
  west: -122.521,
  east: -122.449,
  south: 37.7635,
  north: 37.7755,
};

function bucket(value: number) {
  return Math.round(value / GRID_DEGREES) * GRID_DEGREES;
}

export const ping = mutation({
  args: {
    anonId: v.string(),
    longitude: v.number(),
    latitude: v.number(),
  },
  handler: async (ctx, args) => {
    if (!/^[a-zA-Z0-9_-]{12,80}$/.test(args.anonId)) {
      throw new ConvexError("Invalid anonymous ID");
    }
    if (
      args.longitude < FESTIVAL_BOUNDS.west || args.longitude > FESTIVAL_BOUNDS.east ||
      args.latitude < FESTIVAL_BOUNDS.south || args.latitude > FESTIVAL_BOUNDS.north
    ) {
      throw new ConvexError("Location is outside the festival grounds");
    }

    const longitude = bucket(args.longitude);
    const latitude = bucket(args.latitude);
    const cellId = `${longitude.toFixed(4)}:${latitude.toFixed(4)}`;
    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_anon", (q) => q.eq("anonId", args.anonId))
      .unique();
    const values = { cellId, longitude, latitude, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, values);
    else await ctx.db.insert("presence", { anonId: args.anonId, ...values });

    // Each attendee has only one row. Opportunistic cleanup prevents inactive
    // coarse cells from accumulating without preserving movement history.
    const stale = (await ctx.db.query("presence").collect())
      .filter((entry) => entry.updatedAt < now - CLEANUP_WINDOW_MS);
    await Promise.all(stale.map((entry) => ctx.db.delete(entry._id)));

    return { accepted: true, expiresAt: now + ACTIVE_WINDOW_MS };
  },
});
