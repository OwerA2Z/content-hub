import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository";
import { checkDuplicate } from "../dedup";
import { articleStatusSchema } from "../../shared/contracts";
import { requireAdminSession } from "../auth";
import { requireAdminOrApiToken, requireApiToken } from "../http/middleware";
import { sendError } from "../http/errors";
import { uploadArticle } from "../services/article-upload";

export function createArticlesRouter() {
  const router = Router();
  router.post("/articles/upload", requireApiToken, async (req, res, next) => {
    try { const result = await uploadArticle(req.body); return res.status(result.created ? 201 : 200).json({ data: { article: result.article, created: result.created, capabilities: result.capabilities } }); } catch (error) { return next(error); }
  });
  router.get("/articles", requireAdminOrApiToken, async (req, res, next) => {
    try { const query = z.object({ q: z.string().optional(), status: articleStatusSchema.optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), includeArchived: z.coerce.boolean().default(false) }).parse(req.query); const result = await repository.list(query); return res.json({ data: result.items, meta: { page: query.page, pageSize: query.pageSize, total: result.total } }); } catch (error) { return next(error); }
  });
  router.get("/articles/:id", requireAdminOrApiToken, async (req, res, next) => {
    try { const article = await repository.get(String(req.params.id)); if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在"); return res.json({ data: article }); } catch (error) { return next(error); }
  });
  router.get("/articles/:id/similar", requireAdminOrApiToken, async (req, res, next) => {
    try { const article = await repository.get(String(req.params.id)); if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在"); const result = checkDuplicate({ title: article.title, summary: article.summary, outline: article.outline, topics: article.topics, keywords: article.keywords, content: article.content }, (await repository.listDedupCandidates()).filter((candidate) => candidate.id !== article.id)); return res.json({ data: result }); } catch (error) { return next(error); }
  });
  router.post("/articles/:id/:action", requireAdminSession, async (req, res, next) => {
    try { const action = z.enum(["archive", "restore"]).parse(String(req.params.action)); const status = action === "archive" ? "archived" : "uploaded"; const article = await repository.updateStatus(String(req.params.id), status); if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在"); await repository.recordAudit({ action: `article.${action}`, actorType: "admin", actorId: res.locals.adminUsername, articleId: article.id }); return res.json({ data: article }); } catch (error) { return next(error); }
  });
  return router;
}
