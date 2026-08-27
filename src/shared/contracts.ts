import { z } from "zod";

export const articleStatusSchema = z.enum([
  "uploaded",
  "draft_ready",
  "publish_pending",
  "published",
  "sync_failed",
  "archived",
]);

export type ArticleStatus = z.infer<typeof articleStatusSchema>;

export const strategyStatusSchema = z.enum(["active", "paused", "archived"]);
export const briefStatusSchema = z.enum(["planned", "generating", "completed", "skipped"]);
export type StrategyStatus = z.infer<typeof strategyStatusSchema>;
export type BriefStatus = z.infer<typeof briefStatusSchema>;

export const contentStrategySchema = z.object({
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(1_000),
  audience: z.string().trim().max(500).optional(),
  tone: z.string().trim().max(300).optional(),
  contentPillars: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  avoidTopics: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
});

export const contentSeriesSchema = z.object({
  sequence: z.number().int().min(1).max(10_000).default(1),
  name: z.string().trim().min(1).max(120),
  pillar: z.string().trim().max(100).optional(),
  targetCount: z.number().int().min(1).max(200).default(1),
  orderMode: z.literal("sequential").default("sequential"),
  externalId: z.string().trim().max(200).optional(),
});

export const contentBriefSchema = z.object({
  sequence: z.number().int().min(1).max(10_000),
  titleDirection: z.string().trim().min(1).max(300),
  coreQuestion: z.string().trim().max(500).optional(),
  angle: z.string().trim().max(500).optional(),
  summary: z.string().trim().max(2_000).optional(),
  mustCover: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  mustAvoid: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  noveltyRequirement: z.string().trim().max(1_000).optional(),
  externalId: z.string().trim().max(200).optional(),
});

export type ContentStrategyInput = z.input<typeof contentStrategySchema>;
export type ContentSeriesInput = z.input<typeof contentSeriesSchema>;
export type ContentBriefInput = z.input<typeof contentBriefSchema>;

export const uploadArticleSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().min(1).max(2_000_000),
  contentFormat: z.literal("html"),
  externalId: z.string().trim().max(200).optional(),
  source: z.string().trim().max(100).optional(),
  author: z.string().trim().max(100).optional(),
  digest: z.string().trim().max(300).optional(),
  coverUrl: z.string().url().max(2_000).optional(),
  images: z.array(z.string().url().max(2_000)).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().trim().min(1).max(2_000).optional(),
  outline: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  topics: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  keywords: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  strategyId: z.string().uuid().optional(),
  seriesId: z.string().uuid().optional(),
  briefId: z.string().uuid().optional(),
});

export const articleMediaSchema = z.object({
  coverUrl: z.string().url().max(2_000).optional(),
  images: z.array(z.string().url().max(2_000)).max(100).optional(),
});

export type UploadArticleInput = z.infer<typeof uploadArticleSchema>;

export interface Article {
  id: string;
  externalId?: string;
  source?: string;
  title: string;
  content: string;
  contentFormat: "html";
  author?: string;
  digest?: string;
  coverUrl?: string;
  images: string[];
  metadata: Record<string, unknown>;
  summary?: string;
  outline: string[];
  topics: string[];
  keywords: string[];
  contentHash: string;
  strategyId?: string;
  seriesId?: string;
  briefId?: string;
  status: ArticleStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  publishedAt?: string;
  wechatPublishId?: string;
  publishConfirmed: boolean;
}

export interface ContentStrategy { id: string; name: string; goal: string; audience?: string; tone?: string; contentPillars: string[]; avoidTopics: string[]; status: StrategyStatus; createdAt: string; updatedAt: string; }
export interface ContentSeries { id: string; strategyId: string; sequence: number; name: string; pillar?: string; targetCount: number; orderMode: "sequential"; externalId?: string; status: StrategyStatus; createdAt: string; updatedAt: string; }
export interface ContentBrief { id: string; seriesId: string; sequence: number; titleDirection: string; coreQuestion?: string; angle?: string; summary?: string; mustCover: string[]; mustAvoid: string[]; noveltyRequirement?: string; externalId?: string; status: BriefStatus; createdAt: string; updatedAt: string; }
export interface ContentBriefContext { strategy: ContentStrategy; series: ContentSeries; brief: ContentBrief; relatedArticles: Array<Pick<Article, "id" | "title" | "summary" | "digest" | "publishedAt">>; }

export interface ChannelCapabilities {
  provider: "wechat";
  draft: boolean;
  publish: boolean;
  reason?: string;
}

export interface Operation {
  id: string;
  articleId: string;
  provider: "wechat";
  action: "draft" | "publish";
  status: "pending" | "succeeded" | "failed";
  externalId?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
