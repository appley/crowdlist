import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const stages = sqliteTable("stages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  lineupJson: text("lineup_json").notNull().default("[]"),
});

export const presence = sqliteTable(
  "presence",
  {
    userId: text("user_id").primaryKey(),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("presence_stage_idx").on(table.stageId),
    index("presence_updated_at_idx").on(table.updatedAt),
  ],
);

export const nowPlaying = sqliteTable("now_playing", {
  stageId: text("stage_id")
    .primaryKey()
    .references(() => stages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  source: text("source").notNull(),
  confidence: real("confidence").notNull(),
  status: text("status").notNull(),
});

export const proposals = sqliteTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    source: text("source").notNull(),
    votes: integer("votes").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("proposals_stage_idx").on(table.stageId)],
);

export const setlistItems = sqliteTable(
  "setlist_items",
  {
    id: text("id").primaryKey(),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    playedAt: integer("played_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("setlist_stage_idx").on(table.stageId)],
);
