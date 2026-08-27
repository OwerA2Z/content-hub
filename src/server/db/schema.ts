import { bigint, boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar, integer, unique } from "drizzle-orm/pg-core";

export const contentStrategies = pgTable("content_strategies", {
  id: uuid("id").defaultRandom().primaryKey(), name: varchar("name", { length: 120 }).notNull(), goal: text("goal").notNull(), audience: varchar("audience", { length: 500 }), tone: varchar("tone", { length: 300 }), contentPillars: jsonb("content_pillars").$type<string[]>().notNull().default([]), avoidTopics: jsonb("avoid_topics").$type<string[]>().notNull().default([]), status: varchar("status", { length: 20 }).notNull().default("active"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentSeries = pgTable("content_series", {
  id: uuid("id").defaultRandom().primaryKey(), strategyId: uuid("strategy_id").notNull(), sequence: integer("sequence").notNull().default(1), name: varchar("name", { length: 120 }).notNull(), pillar: varchar("pillar", { length: 100 }), targetCount: integer("target_count").notNull().default(1), orderMode: varchar("order_mode", { length: 30 }).notNull().default("sequential"), externalId: varchar("external_id", { length: 200 }), status: varchar("status", { length: 20 }).notNull().default("active"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentBriefs = pgTable("content_briefs", {
  id: uuid("id").defaultRandom().primaryKey(), seriesId: uuid("series_id").notNull(), sequence: integer("sequence").notNull(), titleDirection: varchar("title_direction", { length: 300 }).notNull(), coreQuestion: varchar("core_question", { length: 500 }), angle: varchar("angle", { length: 500 }), summary: text("summary"), mustCover: jsonb("must_cover").$type<string[]>().notNull().default([]), mustAvoid: jsonb("must_avoid").$type<string[]>().notNull().default([]), noveltyRequirement: text("novelty_requirement"), externalId: varchar("external_id", { length: 200 }), status: varchar("status", { length: 20 }).notNull().default("planned"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ seriesSequenceUnique: unique("content_briefs_series_sequence_uq").on(table.seriesId, table.sequence) }));

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalId: varchar("external_id", { length: 200 }),
    source: varchar("source", { length: 100 }),
    title: varchar("title", { length: 120 }).notNull(),
    content: text("content").notNull(),
    contentFormat: varchar("content_format", { length: 20 }).notNull().default("html"),
    author: varchar("author", { length: 100 }),
    digest: varchar("digest", { length: 300 }),
    coverUrl: text("cover_url"),
    coverAssetId: uuid("cover_asset_id"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    summary: text("summary"),
    outline: jsonb("outline").$type<string[]>().notNull().default([]),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    contentHash: varchar("content_hash", { length: 64 }),
    status: varchar("status", { length: 30 }).notNull().default("uploaded"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    wechatPublishId: text("wechat_publish_id"),
    publishConfirmed: boolean("publish_confirmed").notNull().default(false),
    strategyId: uuid("strategy_id"),
    seriesId: uuid("series_id"),
    briefId: uuid("brief_id"),
  },
  (table) => ({
    sourceExternalIdIdx: index("articles_source_external_id_idx").on(table.source, table.externalId),
    statusIdx: index("articles_status_idx").on(table.status),
  }),
);

export const channelOperations = pgTable("channel_operations", {
  id: uuid("id").defaultRandom().primaryKey(),
  articleId: uuid("article_id").notNull(),
  provider: varchar("provider", { length: 30 }).notNull(),
  action: varchar("action", { length: 30 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  externalId: text("external_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: varchar("kind", { length: 20 }).notNull().default("image"),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  storageKey: varchar("storage_key", { length: 500 }).notNull().unique(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  alt: varchar("alt", { length: 500 }),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: varchar("action", { length: 60 }).notNull(),
  actorType: varchar("actor_type", { length: 30 }).notNull(),
  actorId: varchar("actor_id", { length: 120 }),
  articleId: uuid("article_id"),
  operationId: uuid("operation_id"),
  ip: varchar("ip", { length: 100 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  success: boolean("success").notNull().default(true),
});
