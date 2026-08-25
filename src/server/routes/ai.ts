import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { repository } from "../db/repository";
import { toAiArticle } from "../ai";
import { checkDuplicate, type DuplicateInput } from "../dedup";
import { contentPlanningStore } from "../content-planning";
import { uploadArticle } from "../services/article-upload";
import { sendError } from "../http/errors";
import { requireAiScopes } from "../http/middleware";
import { contentBriefSchema, contentSeriesSchema } from "../../shared/contracts";

export function createAiRouter() {
  const router = Router();
  const requireIdempotencyKey = (req: Request, res: Response) => {
    const key = req.header("idempotency-key")?.trim();
    if (!key || key.length > 200) { sendError(res, 400, "IDEMPOTENCY_KEY_REQUIRED", "AI 内容规划写入必须提供 1-200 位 Idempotency-Key"); return undefined; }
    return key;
  };
  router.post("/ai/articles", requireAiScopes(["articles:write"]), async (req, res, next) => {
    try { const result = await uploadArticle(req.body); return res.status(result.created ? 201 : 200).json({ data: { article: result.article, created: result.created, capabilities: result.capabilities } }); } catch (error) { return next(error); }
  });
  router.post("/ai/content-plan/strategies/:id/series", requireAiScopes(["planning:write"]), async (req, res, next) => {
    try {
      const idempotencyKey = requireIdempotencyKey(req, res);
      if (!idempotencyKey) return;
      const input = contentSeriesSchema.parse({ ...req.body, externalId: idempotencyKey });
      const item = await contentPlanningStore.createSeries(String(req.params.id), input);
      await repository.recordAudit({ action: "ai.content_plan.series.create", actorType: "api", actorId: "ai" });
      return res.status(201).json({ data: item });
    } catch (error) { return next(error); }
  });
  router.post("/ai/content-plan/series/:id/briefs", requireAiScopes(["planning:write"]), async (req, res, next) => {
    try {
      const idempotencyKey = requireIdempotencyKey(req, res);
      if (!idempotencyKey) return;
      const input = contentBriefSchema.parse({ ...req.body, externalId: idempotencyKey });
      const item = await contentPlanningStore.createBrief(String(req.params.id), input);
      await repository.recordAudit({ action: "ai.content_plan.brief.create", actorType: "api", actorId: "ai" });
      return res.status(201).json({ data: item });
    } catch (error) { return next(error); }
  });
  router.patch("/ai/content-plan/briefs/:id", requireAiScopes(["planning:write"]), async (req, res, next) => {
    try {
      const input = z.object({ titleDirection: z.string().trim().min(1).max(300).optional(), coreQuestion: z.string().trim().max(500).optional(), angle: z.string().trim().max(500).optional(), summary: z.string().trim().max(2_000).optional(), mustCover: z.array(z.string().trim().min(1).max(300)).max(50).optional(), mustAvoid: z.array(z.string().trim().min(1).max(300)).max(50).optional(), noveltyRequirement: z.string().trim().max(1_000).optional() }).strict().parse(req.body);
      const item = await contentPlanningStore.updateBrief(String(req.params.id), input);
      if (!item) return sendError(res, 404, "NOT_FOUND", "文章任务不存在");
      await repository.recordAudit({ action: "ai.content_plan.brief.update", actorType: "api", actorId: "ai" });
      return res.json({ data: item });
    } catch (error) { return next(error); }
  });
  router.get("/ai/articles", requireAiScopes(["articles:read"]), async (req, res, next) => {
    try {
      const query = z.object({ q: z.string().trim().max(200).optional(), source: z.string().trim().max(100).optional(), from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(), limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().max(500).optional() }).parse(req.query);
      const page = await repository.listAiArticles(query);
      return res.json({ data: { items: page.items.map((article) => toAiArticle(article, "text")), nextCursor: page.nextCursor, hasMore: page.hasMore, dataVersion: "published-v1" } });
    } catch (error) { return next(error); }
  });
  router.get("/ai/articles/:id", requireAiScopes(["articles:read"]), async (req, res, next) => {
    try { const format = z.enum(["text", "html"]).default("text").parse(req.query.format); const article = await repository.getAiArticle(String(req.params.id)); if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在"); return res.json({ data: toAiArticle(article, format) }); } catch (error) { return next(error); }
  });
  router.get("/ai/content-plan/next", requireAiScopes(["planning:read"]), async (_req, res, next) => {
    try { const context = await contentPlanningStore.getNextContext(); if (!context) return res.json({ data: null }); const related = await repository.listPlanArticles(context.strategy.id, context.series.id, 10); return res.json({ data: { ...context, relatedArticles: related.map((article) => ({ id: article.id, title: article.title, summary: article.summary, digest: article.digest, publishedAt: article.publishedAt })) } }); } catch (error) { return next(error); }
  });
  router.get("/ai/content-plan/briefs/:id", requireAiScopes(["planning:read"]), async (req, res, next) => {
    try { const context = await contentPlanningStore.getBriefContext(String(req.params.id)); if (!context || context.brief.status !== "planned" || context.series.status !== "active" || context.strategy.status !== "active") return sendError(res, 404, "NOT_FOUND", "内容任务不存在"); const related = await repository.listPlanArticles(context.strategy.id, context.series.id, 10); return res.json({ data: { ...context, relatedArticles: related.map((article) => ({ id: article.id, title: article.title, summary: article.summary, digest: article.digest, publishedAt: article.publishedAt })) } }); } catch (error) { return next(error); }
  });
  router.post("/ai/articles/check-duplicate", requireAiScopes(["dedup:check"]), async (req, res, next) => {
    try { const input = z.object({ title: z.string().trim().min(1).max(120), summary: z.string().trim().max(2_000).optional(), outline: z.array(z.string().trim().max(300)).max(30).optional(), topics: z.array(z.string().trim().max(100)).max(20).optional(), keywords: z.array(z.string().trim().max(100)).max(50).optional(), content: z.string().max(2_000_000).optional() }).parse(req.body) as DuplicateInput; const result = checkDuplicate(input, await repository.listDedupCandidates()); return res.json({ data: { ...result, advisory: true } }); } catch (error) { return next(error); }
  });
  return router;
}
