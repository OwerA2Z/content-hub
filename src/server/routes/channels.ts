import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository";
import { wechatProvider } from "../channels/wechat";
import { requireAdminOrScopes } from "../http/middleware";
import { requireAdminSession } from "../auth";
import { sendError } from "../http/errors";
import { processChannelOperation } from "../services/channel-operations";
import { mediaAssetRepository } from "../media-library";
import { wechatSettings } from "../wechat-settings";

export function createChannelsRouter() {
  const router = Router();
  // 凭证接口仅接受管理员会话，普通集成 Token 即使具备草稿权限也不能读取或修改配置。
  router.get("/channels/wechat/settings", requireAdminSession, async (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    try { return res.json({ data: await wechatSettings.info() }); } catch (error) { return next(error); }
  });
  router.put("/channels/wechat/settings", requireAdminSession, async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const parsed = z.object({ appId: z.string().trim().regex(/^wx[a-zA-Z0-9]{16}$/, "AppID 格式应为 wx 开头的 18 位字符"), appSecret: z.string().trim().max(256).optional() }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_WECHAT_SETTINGS", parsed.error.issues[0].message);
    try {
      const data = await wechatSettings.save(parsed.data);
      await repository.recordAudit({ action: "wechat.settings.update", actorType: "admin", actorId: res.locals.adminUsername });
      return res.json({ data });
    } catch (error) { return next(error); }
  });
  router.post("/channels/wechat/test", requireAdminSession, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try { await wechatProvider.testConnection(); return res.json({ data: { connected: true } }); }
    catch (error) {
      // 微信错误可能包含请求数据，只保留错误码，不返回原始响应或含密钥的请求地址。
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
      return sendError(res, 400, "WECHAT_CONNECTION_FAILED", `连接失败${code ? `（${code}）` : ""}，请检查凭证、服务器网络及公众号 IP 白名单`);
    }
  });
  router.get("/channels/wechat/capabilities", requireAdminSession, async (_req, res, next) => {
    try { return res.json({ data: await wechatProvider.getCapabilities() }); } catch (error) { return next(error); }
  });
  // 具体的 retry 路由必须先于参数化 action 路由，否则会被 action=retry 截获。
  router.post("/articles/:id/wechat/retry", requireAdminSession, async (req, res, next) => {
    try {
      const articleId = String(req.params.id);
      const article = await repository.get(articleId);
      if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在");
      const failed = await repository.getLatestFailedOperation(articleId);
      if (!failed) return sendError(res, 409, "NO_FAILED_OPERATION", "没有可重试的微信操作");
      // 重试必须与首次提交执行相同能力校验，防止无凭证时误走开发模拟链路。
      const capabilities = await wechatProvider.getCapabilities();
      if (failed.action === "draft" ? !capabilities.draft : !capabilities.publish) return sendError(res, 403, "CHANNEL_CAPABILITY_UNAVAILABLE", capabilities.reason ?? "当前公众号不支持此操作");
      const operation = await repository.createOperation(articleId, failed.action);
      void processChannelOperation(operation.id, articleId, failed.action, failed.externalId);
      return res.status(202).json({ data: operation });
    } catch (error) { return next(error); }
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
      if (action === "draft" && !article.coverAssetId && !article.coverUrl && !article.images[0]) return sendError(res, 400, "COVER_REQUIRED", "创建微信公众号草稿前必须提供封面素材、coverUrl 或 images[0]");
      if (action === "draft" && article.coverAssetId) {
        const asset = await mediaAssetRepository.get(article.coverAssetId);
        if (!asset || asset.status !== "active") return sendError(res, 400, "MEDIA_ASSET_UNAVAILABLE", "创建微信公众号草稿前必须提供有效的封面素材");
      }
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
