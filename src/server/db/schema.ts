import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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
