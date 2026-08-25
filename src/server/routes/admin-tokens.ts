import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository";
import { tokenStore, normalizeScopes } from "../tokens";
import { TOKEN_SCOPES } from "../../shared/scopes";
import { requireAdminSession } from "../auth";
import { sendError } from "../http/errors";

export function createAdminTokensRouter() {
  const router = Router();
  router.get("/admin/tokens", requireAdminSession, async (_req, res, next) => { try { return res.json({ data: await tokenStore.list() }); } catch (error) { return next(error); } });
  router.post("/admin/tokens", requireAdminSession, async (req, res, next) => { try { const input = z.object({ name: z.string().trim().min(1).max(120), scopes: z.array(z.enum(TOKEN_SCOPES)).min(1).max(8) }).parse(req.body); const created = await tokenStore.create(input.name, normalizeScopes(input.scopes)); await repository.recordAudit({ action: "admin.token.create", actorType: "admin", actorId: res.locals.adminUsername }); return res.status(201).json({ data: created }); } catch (error) { return next(error); } });
  router.post("/admin/tokens/:id/revoke", requireAdminSession, async (req, res, next) => { try { const revoked = await tokenStore.revoke(String(req.params.id)); if (!revoked) return sendError(res, 404, "NOT_FOUND", "Token 不存在或已撤销"); await repository.recordAudit({ action: "admin.token.revoke", actorType: "admin", actorId: res.locals.adminUsername }); return res.json({ data: { revoked: true } }); } catch (error) { return next(error); } });
  return router;
}
