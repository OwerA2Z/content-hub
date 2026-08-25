import { Router } from "express";
import { contentPlanningStore } from "../content-planning";
import { contentBriefSchema, contentSeriesSchema, contentStrategySchema, briefStatusSchema, strategyStatusSchema } from "../../shared/contracts";
import { requireAdminSession } from "../auth";
import { requireAdminOrScopes } from "../http/middleware";
import { sendError } from "../http/errors";

export function createPlanningRouter() {
  const router = Router();
  router.get("/strategies", requireAdminOrScopes(["planning:read"]), async (_req, res, next) => { try { return res.json({ data: await contentPlanningStore.listStrategies() }); } catch (error) { return next(error); } });
  router.post("/strategies", requireAdminSession, async (req, res, next) => { try { const item = await contentPlanningStore.createStrategy(contentStrategySchema.parse(req.body)); return res.status(201).json({ data: item }); } catch (error) { return next(error); } });
  router.patch("/strategies/:id", requireAdminSession, async (req, res, next) => { try { const values = contentStrategySchema.partial().extend({ status: strategyStatusSchema.optional() }).parse(req.body); const item = await contentPlanningStore.updateStrategy(String(req.params.id), values); if (!item) return sendError(res, 404, "NOT_FOUND", "内容战略不存在"); return res.json({ data: item }); } catch (error) { return next(error); } });
  router.get("/strategies/:id/series", requireAdminOrScopes(["planning:read"]), async (req, res, next) => { try { return res.json({ data: await contentPlanningStore.listSeries(String(req.params.id)) }); } catch (error) { return next(error); } });
  router.post("/strategies/:id/series", requireAdminSession, async (req, res, next) => { try { const item = await contentPlanningStore.createSeries(String(req.params.id), contentSeriesSchema.parse(req.body)); return res.status(201).json({ data: item }); } catch (error) { return next(error); } });
  router.patch("/series/:id", requireAdminSession, async (req, res, next) => { try { const values = contentSeriesSchema.partial().extend({ status: strategyStatusSchema.optional() }).parse(req.body); const item = await contentPlanningStore.updateSeries(String(req.params.id), values); if (!item) return sendError(res, 404, "NOT_FOUND", "内容系列不存在"); return res.json({ data: item }); } catch (error) { return next(error); } });
  router.get("/series/:id/briefs", requireAdminOrScopes(["planning:read"]), async (req, res, next) => { try { return res.json({ data: await contentPlanningStore.listBriefs(String(req.params.id)) }); } catch (error) { return next(error); } });
  router.post("/series/:id/briefs", requireAdminSession, async (req, res, next) => { try { const item = await contentPlanningStore.createBrief(String(req.params.id), contentBriefSchema.parse(req.body)); return res.status(201).json({ data: item }); } catch (error) { return next(error); } });
  router.patch("/briefs/:id", requireAdminSession, async (req, res, next) => { try { const values = contentBriefSchema.partial().extend({ status: briefStatusSchema.optional() }).parse(req.body); const item = await contentPlanningStore.updateBrief(String(req.params.id), values); if (!item) return sendError(res, 404, "NOT_FOUND", "文章任务不存在"); return res.json({ data: item }); } catch (error) { return next(error); } });
  return router;
}
