import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository";
import { wechatProvider } from "../channels/wechat";
import { requireAdminOrScopes } from "../http/middleware";
import { requireAdminSession } from "../auth";
import { sendError } from "../http/errors";
import { processChannelOperation } from "../services/channel-operations";

export function createChannelsRouter() {
  const router = Router();
  router.get("/channels/wechat/capabilities", requireAdminSession, async (_req, res, next) => {
    try { return res.json({ data: await wechatProvider.getCapabilities() }); } catch (error) { return next(error); }
  });
  // 具体的 retry 路由必须先于参数化 action 路由，否则会被 action=retry 截获。
  router.post("/articles/:id/wechat/retry", requireAdminSession, async (req, res, next) => {
    try { const articleId = String(req.params.id); const article = await repository.get(articleId); if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在"); const failed = await repository.getLatestFailedOperation(articleId); if (!failed) return sendError(res, 409, "NO_FAILED_OPERATION", "没有可重试的微信操作"); const operation = await repository.createOperation(articleId, failed.action); void processChannelOperation(operation.id, articleId, failed.action, failed.externalId); return res.status(202).json({ data: operation }); } catch (error) { return next(error); }
  });
  router.post("/articles/:id/wechat/:action", async (req, res, next) => {
    const requiredScope = String(req.params.action) === "draft" ? ["wechat:draft"] as const : ["wechat:publish"] as const;
    return requireAdminOrScopes(requiredScope)(req, res, next);
  }, async (req, res, next) => {
    try {
      const action = z.enum(["draft", "publish"]).parse(String(req.params.action));
      const draftId = z.object({ draftId: z.string().trim().min(1).optional() }).parse(req.body ?? {}).draftId;
      const article = await repository.get(String(req.params.id));
      if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在");
      const capabilities = await wechatProvider.getCapabilities();
      if ((action === "draft" && !capabilities.draft) || (action === "publish" && !capabilities.publish)) return sendError(res, 403, "CHANNEL_CAPABILITY_UNAVAILABLE", capabilities.reason ?? "当前公众号不支持此操作");
      const operation = await repository.createOperation(article.id, action);
      await repository.recordAudit({ action: `wechat.${action}`, actorType: res.locals.authActorType ?? "admin", actorId: res.locals.adminUsername, articleId: article.id, operationId: operation.id });
      void processChannelOperation(operation.id, article.id, action, draftId);
      return res.status(202).json({ data: operation });
    } catch (error) { return next(error); }
  });
  router.get("/operations/:id", requireAdminOrScopes(["operations:read"]), async (req, res, next) => {
    try { const operation = await repository.getOperation(String(req.params.id)); if (!operation) return sendError(res, 404, "NOT_FOUND", "操作不存在"); return res.json({ data: operation }); } catch (error) { return next(error); }
  });
  return router;
}
