import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config";
import type { Article } from "../shared/contracts";

const requests = new Map<string, { count: number; resetAt: number }>();

export function requireAiReadToken(req: Request, res: Response, next: NextFunction) {
  if (!config.AI_READ_TOKEN) return res.status(503).json({ error: { code: "AI_READ_NOT_CONFIGURED", message: "AI_READ_TOKEN 未配置" } });
  const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(config.AI_READ_TOKEN);
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: { code: "AI_UNAUTHORIZED", message: "AI 只读凭证无效" } });
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const usage = requests.get(key);
  if (usage && usage.resetAt > now && usage.count >= 120) return res.status(429).json({ error: { code: "RATE_LIMITED", message: "AI 读取请求过于频繁" } });
  if (!usage || usage.resetAt <= now) requests.set(key, { count: 1, resetAt: now + 60_000 });
  else usage.count += 1;
  next();
}

export function toAiArticle(article: Article, format: "text" | "html") {
  const base = {
    id: article.id,
    title: article.title,
    digest: article.digest,
    summary: article.summary,
    outline: article.outline,
    topics: article.topics,
    keywords: article.keywords,
    author: article.author,
    source: article.source,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    coverUrl: article.coverUrl,
    metadata: pickPublicMetadata(article.metadata),
  };
  return format === "html"
    ? { ...base, contentHtml: sanitizeHtml(article.content), contentFormat: "html" as const }
    : { ...base, contentText: htmlToText(article.content), contentFormat: "text" as const };
}

function pickPublicMetadata(metadata: Record<string, unknown>) {
  const allowed = new Set(["category", "categories", "tags", "keywords"]);
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => allowed.has(key) && (typeof value === "string" || Array.isArray(value))));
}

export function sanitizeHtml(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|src)\s*=\s*["']\s*javascript:[^"']*["']/gi, "");
}

export function htmlToText(html: string) {
  return sanitizeHtml(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|section|article|blockquote)\s*>/gi, "\n")
    .replace(/<img[^>]*>/gi, " [图片] ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}
