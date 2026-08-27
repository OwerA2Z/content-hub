import type { Article } from "../shared/contracts";

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
    // 返回素材 ID 让 AI 能复用已有本地封面，而不是重复上传同一张图片。
    coverAssetId: article.coverAssetId,
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
