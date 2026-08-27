import { Router } from "express";
import { z } from "zod";
import { candidateInputSchema } from "../../shared/candidate-pools";
import { candidatePoolStore, currentPoolDate } from "../candidate-pools";
import { repository } from "../db/repository";
import { requireAdminOrScopes, requireAiScopes } from "../http/middleware";
import { sendError } from "../http/errors";
import { mediaAssetRepository } from "../media-library";

export function createCandidatesRouter() {
  const router = Router();
  router.get("/candidate-pools/daily", requireAdminOrScopes(["recommendations:read"]), async (_req, res, next) => { try { return res.json({ data: await candidatePoolStore.getDaily() }); } catch (error) { return next(error); } });
  router.post("/ai/candidate-pools/daily/candidates", requireAiScopes(["recommendations:write"]), async (req, res, next) => {
    try { const input = z.object({ candidates: z.array(candidateInputSchema).min(1).max(10) }).parse(req.body); for (const candidate of input.candidates) { if (candidate.coverAssetId) { const asset = await mediaAssetRepository.get(candidate.coverAssetId); if (!asset || asset.status !== "active") return sendError(res, 400, "MEDIA_ASSET_UNAVAILABLE", "候选文章封面素材不存在或已归档"); } } const items = await candidatePoolStore.submit(currentPoolDate(), input.candidates); await repository.recordAudit({ action: "ai.candidate_pool.submit", actorType: "api", actorId: "ai" }); return res.status(201).json({ data: { ...(await candidatePoolStore.getDaily()), submitted: items.map((item) => item.id) } }); } catch (error) { return next(error); }
  });
  router.post("/ai/candidate-pools/daily/recheck", requireAdminOrScopes(["recommendations:write"]), async (_req, res, next) => { try { return res.json({ data: { pool: await candidatePoolStore.recheck(currentPoolDate()) } }); } catch (error) { return next(error); } });
  router.post("/candidate-pools/daily/candidates/:id/accept", requireAdminOrScopes(["recommendations:accept"]), async (req, res, next) => {
    try { const candidate = await candidatePoolStore.getCandidate(String(req.params.id)); if (!candidate) return sendError(res, 404, "NOT_FOUND", "候选文章不存在"); if (["stale", "rejected"].includes(candidate.status)) return sendError(res, 409, "CANDIDATE_UNAVAILABLE", "候选文章已失效，不能接受"); const result = await repository.createOrGet({ externalId: candidate.externalId, source: candidate.source ?? "daily-candidate-pool", title: candidate.title, content: candidate.content, contentFormat: "html", author: candidate.author, digest: candidate.digest, summary: candidate.summary, outline: candidate.outline, topics: candidate.topics, keywords: candidate.keywords, coverUrl: candidate.coverUrl, coverAssetId: candidate.coverAssetId, strategyId: candidate.strategyId, seriesId: candidate.seriesId, briefId: candidate.briefId }); await candidatePoolStore.accept(candidate.id, result.article.id); await repository.recordAudit({ action: "candidate_pool.accept", actorType: res.locals.authActorType ?? "admin", actorId: res.locals.adminUsername, articleId: result.article.id }); return res.status(result.created ? 201 : 200).json({ data: { candidate: await candidatePoolStore.getCandidate(candidate.id), article: result.article, created: result.created } }); } catch (error) { return next(error); }
  });
  return router;
}
