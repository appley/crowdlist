import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";

const SERIES_ID = "jambase:13969984";
const EVENT_ID = "jambase:15738826";
const ENDPOINT = "https://api.data.jambase.com/v3/festivals/13969984/events?expandExternalIdentifiers=true";
const SIX_HOURS = 6 * 60 * 60 * 1_000;

type ExternalIdentifier = { source?: string; identifier?: string[] };
type JamBasePerformer = {
  identifier?: string;
  name?: string;
  image?: string;
  genre?: string[];
  "x-performanceDate"?: string;
  "x-performanceRank"?: number;
  "x-isHeadliner"?: boolean;
  "x-externalIdentifiers"?: ExternalIdentifier[];
};
type JamBaseEvent = { identifier?: string; startDate?: string; performer?: JamBasePerformer[] };

export const status = query({
  args: {},
  handler: async (ctx) => {
    const sync = await ctx.db.query("metadata").withIndex("by_key", (q) => q.eq("key", "jambase:lastSync")).unique();
    const artists = await ctx.db.query("jambaseArtists").collect();
    return { seriesId: SERIES_ID, eventId: EVENT_ID, artistCount: artists.length, lastSync: sync ? Number(sync.value) : null };
  },
});

export const lastSync = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sync = await ctx.db.query("metadata").withIndex("by_key", (q) => q.eq("key", "jambase:lastSync")).unique();
    return sync ? Number(sync.value) : null;
  },
});

export const cacheArtists = internalMutation({
  args: {
    artists: v.array(v.object({
      jambaseId: v.string(),
      eventId: v.string(),
      name: v.string(),
      image: v.optional(v.string()),
      genres: v.array(v.string()),
      spotifyId: v.optional(v.string()),
      performanceDate: v.string(),
      performanceRank: v.number(),
      headliner: v.boolean(),
    })),
    importedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const artist of args.artists) {
      const existing = await ctx.db.query("jambaseArtists").withIndex("by_jambase_id", (q) => q.eq("jambaseId", artist.jambaseId)).unique();
      if (existing) await ctx.db.patch(existing._id, { ...artist, importedAt: args.importedAt });
      else await ctx.db.insert("jambaseArtists", { ...artist, importedAt: args.importedAt });
    }
    const existingSync = await ctx.db.query("metadata").withIndex("by_key", (q) => q.eq("key", "jambase:lastSync")).unique();
    const sync = { value: String(args.importedAt), updatedAt: args.importedAt };
    if (existingSync) await ctx.db.patch(existingSync._id, sync);
    else await ctx.db.insert("metadata", { key: "jambase:lastSync", ...sync });
    return { imported: args.artists.length };
  },
});

export const importFestival = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ imported: number; cached: boolean }> => {
    const previous = await ctx.runQuery(internal.jambase.lastSync, {});
    if (!args.force && previous && previous > Date.now() - SIX_HOURS) return { imported: 0, cached: true };
    const apiKey = process.env.JAMBASE_API_KEY;
    if (!apiKey) throw new Error("JAMBASE_API_KEY is not configured in Convex");

    const response = await fetch(ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`JamBase request failed (${response.status})`);
    const payload = (await response.json()) as { events?: JamBaseEvent[] };
    const event = payload.events?.find((candidate) => candidate.identifier === EVENT_ID || candidate.startDate?.startsWith("2026"));
    if (!event?.performer) throw new Error("The 2026 Outside Lands event was not present in the JamBase response");

    const artists = event.performer.flatMap((performer) => {
      if (!performer.identifier || !performer.name || !performer["x-performanceDate"]) return [];
      const spotify = performer["x-externalIdentifiers"]?.find((entry) => entry.source === "spotify")?.identifier?.[0];
      return [{
        jambaseId: performer.identifier,
        eventId: EVENT_ID,
        name: performer.name,
        image: performer.image,
        genres: performer.genre ?? [],
        spotifyId: spotify,
        performanceDate: performer["x-performanceDate"],
        performanceRank: performer["x-performanceRank"] ?? 999,
        headliner: performer["x-isHeadliner"] ?? false,
      }];
    });
    const result = await ctx.runMutation(internal.jambase.cacheArtists, { artists, importedAt: Date.now() });
    return { ...result, cached: false };
  },
});
