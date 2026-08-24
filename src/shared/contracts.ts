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
  status: ArticleStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  publishedAt?: string;
  wechatPublishId?: string;
  publishConfirmed: boolean;
}

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
