import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository";
import { requireAiReadToken, requireAiWriteToken, toAiArticle } from "../ai";
import { checkDuplicate, type DuplicateInput } from "../dedup";
import { contentPlanningStore } from "../content-planning";
import { uploadArticle } from "../services/article-upload";
import { sendError } from "../http/errors";

export function createAiRouter() {
  const router = Router();
  router.post("/ai/articles", requireAiWriteToken, async (req, res, next) => {
    try { const result = await uploadArticle(req.body); return res.status(result.created ? 201 : 200).json({ data: { article: result.article, created: result.created, capabilities: result.capabilities } }); } catch (error) { return next(error); }
  });
  router.get("/ai/articles", requireAiReadToken, async (req, res, next) => {
    try {
      const query = z.object({ q: z.string().trim().max(200).optional(), source: z.string().trim().max(100).optional(), from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(), limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().max(500).optional() }).parse(req.query);
      const page = await repository.listAiArticles(query);
      return res.json({ data: { items: page.items.map((article) => toAiArticle(article, "text")), nextCursor: page.nextCursor, hasMore: page.hasMore, dataVersion: "published-v1" } });
    } catch (error) { return next(error); }
  });
  router.get("/ai/articles/:id", requireAiReadToken, async (req, res, next) => {
    try { const format = z.enum(["text", "html"]).default("text").parse(req.query.format); const article = await repository.getAiArticle(String(req.params.id)); if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在"); return res.json({ data: toAiArticle(article, format) }); } catch (error) { return next(error); }
  });
  router.get("/ai/content-plan/next", requireAiReadToken, async (_req, res, next) => {
    try { const context = await contentPlanningStore.getNextContext(); if (!context) return res.json({ data: null }); const related = await repository.listPlanArticles(context.strategy.id, context.series.id, 10); return res.json({ data: { ...context, relatedArticles: related.map((article) => ({ id: article.id, title: article.title, summary: article.summary, digest: article.digest, publishedAt: article.publishedAt })) } }); } catch (error) { return next(error); }
  });
  router.get("/ai/content-plan/briefs/:id", requireAiReadToken, async (req, res, next) => {
    try { const context = await contentPlanningStore.getBriefContext(String(req.params.id)); if (!context || context.brief.status !== "planned" || context.series.status !== "active" || context.strategy.status !== "active") return sendError(res, 404, "NOT_FOUND", "内容任务不存在"); const related = await repository.listPlanArticles(context.strategy.id, context.series.id, 10); return res.json({ data: { ...context, relatedArticles: related.map((article) => ({ id: article.id, title: article.title, summary: article.summary, digest: article.digest, publishedAt: article.publishedAt })) } }); } catch (error) { return next(error); }
  });
  router.post("/ai/articles/check-duplicate", requireAiReadToken, async (req, res, next) => {
    try { const input = z.object({ title: z.string().trim().min(1).max(120), summary: z.string().trim().max(2_000).optional(), outline: z.array(z.string().trim().max(300)).max(30).optional(), topics: z.array(z.string().trim().max(100)).max(20).optional(), keywords: z.array(z.string().trim().max(100)).max(50).optional(), content: z.string().max(2_000_000).optional() }).parse(req.body) as DuplicateInput; const result = checkDuplicate(input, await repository.listDedupCandidates()); return res.json({ data: { ...result, advisory: true } }); } catch (error) { return next(error); }
  });
  return router;
}
