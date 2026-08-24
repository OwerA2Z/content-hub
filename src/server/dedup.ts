import { createHash } from "node:crypto";
import type { Article } from "../shared/contracts";
import { sanitizeHtml } from "./ai";

export interface DuplicateInput {
  title: string;
  summary?: string;
  outline?: string[];
  topics?: string[];
  keywords?: string[];
  content?: string;
}

export interface DuplicateCandidate {
  articleId: string;
  title: string;
  digest?: string;
  similarity: number;
  reason: string;
  matchedDimensions: string[];
  matchedKeywords: string[];
}

export interface DuplicateResult {
  exactDuplicate: boolean;
  risk: "low" | "medium" | "high" | "exact";
  similarity: number;
  candidates: DuplicateCandidate[];
  warnings: string[];
}

export function normalizeContent(html: string) {
  return sanitizeHtml(html)
    .replace(/<img[^>]*>/gi, " [图片] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

export function contentHash(html: string) { return createHash("sha256").update(normalizeContent(html)).digest("hex"); }

function tokens(value: string) {
  const lower = value.toLowerCase();
  const latin = lower.match(/[a-z0-9]+/g) ?? [];
  const cjk = [...lower].filter((char) => /[\u4e00-\u9fff]/.test(char));
  return new Set([...latin, ...cjk]);
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size && !right.size) return 0;
  const intersection = [...left].filter((item) => right.has(item)).length;
  return intersection / new Set([...left, ...right]).size;
}

function overlap(left: string[], right: string[]) { return jaccard(tokens(left.join(" ")), tokens(right.join(" "))); }

export function compareArticle(input: DuplicateInput, article: Article): DuplicateCandidate {
  const titleScore = jaccard(tokens(input.title), tokens(article.title));
  const summaryScore = jaccard(tokens(input.summary ?? ""), tokens(article.summary ?? article.digest ?? ""));
  const topicScore = overlap([...(input.topics ?? []), ...(input.keywords ?? [])], [...article.topics, ...article.keywords]);
  const contentScore = input.content ? jaccard(tokens(normalizeContent(input.content)), tokens(normalizeContent(article.content))) : 0;
  const similarity = Number((titleScore * 0.3 + summaryScore * 0.3 + topicScore * 0.2 + contentScore * 0.2).toFixed(4));
  const matchedDimensions = [titleScore > 0.35 ? "title" : "", summaryScore > 0.35 ? "summary" : "", topicScore > 0.25 ? "topics" : "", contentScore > 0.35 ? "content" : ""].filter(Boolean);
  const matchedKeywords = [...new Set([...(input.topics ?? []), ...(input.keywords ?? [])].filter((item) => [...article.topics, ...article.keywords].some((other) => other.toLowerCase() === item.toLowerCase())))].slice(0, 10);
  return { articleId: article.id, title: article.title, digest: article.digest ?? article.summary, similarity, matchedDimensions, matchedKeywords, reason: matchedDimensions.length ? `重合维度：${matchedDimensions.join("、")}` : "整体词项重合度较低" };
}

export function checkDuplicate(input: DuplicateInput, articles: Article[]): DuplicateResult {
  const hash = input.content ? contentHash(input.content) : undefined;
  const exact = hash ? articles.find((article) => article.contentHash === hash) : undefined;
  const candidates = articles
    .filter((article) => !article.archivedAt && (article.status === "uploaded" || article.status === "draft_ready" || article.status === "publish_pending" || article.status === "published"))
    .map((article) => ({ article, candidate: compareArticle(input, article) }))
    .filter(({ candidate }) => candidate.similarity >= 0.2 || Boolean(exact && exact.id === candidate.articleId))
    .sort((left, right) => right.candidate.similarity - left.candidate.similarity)
    .slice(0, 10)
    .map(({ candidate }) => candidate);
  const best = candidates[0]?.similarity ?? 0;
  const exactDuplicate = Boolean(exact);
  const risk = exactDuplicate ? "exact" : best > 0.75 ? "high" : best >= 0.45 ? "medium" : "low";
  const warnings: string[] = [];
  if (exactDuplicate) warnings.push("正文指纹完全一致，建议不要重复生成。");
  else if (risk === "high") warnings.push("核心内容高度相似，建议更换核心观点、案例或文章结构。");
  else if (risk === "medium") warnings.push("存在部分主题重合，建议补充新的角度和独立案例。");
  else warnings.push("未发现明显重复，但仍建议由 AI 进行最终语义判断。");
  return { exactDuplicate, risk, similarity: best, candidates, warnings };
}
