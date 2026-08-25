import { Router } from "express";
import { config } from "../config";
import { requireAdminSession } from "../auth";

export function createIntegrationsRouter() {
  const router = Router();
  router.get("/integrations/ai", requireAdminSession, async (req, res, next) => {
    const baseUrl = config.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
    try { return res.json({ data: { baseUrl, readTokenConfigured: Boolean(config.AI_READ_TOKEN), writeTokenConfigured: Boolean(config.AI_WRITE_TOKEN), endpoints: { readList: `${baseUrl}/api/v1/ai/articles`, readDetail: `${baseUrl}/api/v1/ai/articles/:id`, nextBrief: `${baseUrl}/api/v1/ai/content-plan/next`, checkDuplicate: `${baseUrl}/api/v1/ai/articles/check-duplicate`, uploadArticle: `${baseUrl}/api/v1/ai/articles` } } }); } catch (error) { return next(error); }
  });
  return router;
}
