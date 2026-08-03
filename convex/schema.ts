import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const crowd = v.union(
  v.literal("easy"),
  v.literal("comfortable"),
  v.literal("busy"),
  v.literal("packed"),
);

const energy = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
const trend = v.union(v.literal("rising"), v.literal("steady"), v.literal("falling"));

export default defineSchema({
  pulses: defineTable({
    stageId: v.string(),
    crowd,
    energy,
    trend,
    reportCount: v.number(),
    baselineCount: v.optional(v.number()),
    updatedAt: v.number(),
    source: v.union(
      v.literal("seeded-demo"),
      v.literal("community"),
      v.literal("mixed"),
    ),
    summary: v.optional(v.string()),
  }).index("by_stage", ["stageId"]),

  reports: defineTable({
    stageId: v.string(),
    crowd,
    energy,
    trend,
    anonId: v.string(),
    hasText: v.boolean(),
    createdAt: v.number(),
    parsedCrowd: v.optional(crowd),
    parsedEnergy: v.optional(energy),
    parsedTrend: v.optional(trend),
    summary: v.optional(v.string()),
  })
    .index("by_anon_created", ["anonId", "createdAt"])
    .index("by_stage_created", ["stageId", "createdAt"]),

  presence: defineTable({
    anonId: v.string(),
    cellId: v.string(),
    longitude: v.number(),
    latitude: v.number(),
    updatedAt: v.number(),
  }).index("by_anon", ["anonId"]),

  songConfirmations: defineTable({
    stageId: v.string(),
    anonId: v.string(),
    title: v.string(),
    artists: v.array(v.string()),
    acrid: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_stage_created", ["stageId", "createdAt"])
    .index("by_anon_stage", ["anonId", "stageId"]),

  jambaseArtists: defineTable({
    jambaseId: v.string(),
    eventId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    genres: v.array(v.string()),
    spotifyId: v.optional(v.string()),
    performanceDate: v.string(),
    performanceRank: v.number(),
    headliner: v.boolean(),
    importedAt: v.number(),
  })
    .index("by_jambase_id", ["jambaseId"])
    .index("by_event_rank", ["eventId", "performanceDate", "performanceRank"]),

  metadata: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
