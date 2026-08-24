import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "./config";
import { repository, repositoryKind, repositoryReady } from "./db/repository";
import { wechatProvider } from "./channels/wechat";
import { uploadArticleSchema, articleStatusSchema, type ApiErrorBody } from "../shared/contracts";
import { clearSession, requireAdminSession, setSession } from "./auth";
import { userStore, userStoreReady, validateNewUser } from "./users";
import { requireAiReadToken, toAiArticle } from "./ai";
import { checkDuplicate, type DuplicateInput } from "./dedup";
import { contentPlanningStore } from "./content-planning";
import { contentBriefSchema, contentSeriesSchema, contentStrategySchema, briefStatusSchema, strategyStatusSchema } from "../shared/contracts";

const app = express();
app.use(express.json({ limit: "2mb" }));
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const recoveryAttempts = new Map<string, { count: number; resetAt: number }>();

const sendError = (res: Response, status: number, code: string, message: string, details?: unknown) => {
  const body: ApiErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  res.status(status).json(body);
};

const requireApiToken = (req: Request, res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  if (header !== `Bearer ${config.API_TOKEN}`) return sendError(res, 401, "UNAUTHORIZED", "需要有效的 Bearer Token");
  next();
};

const requireAdminOrApiToken = (req: Request, res: Response, next: NextFunction) => {
  if (req.header("authorization") === `Bearer ${config.API_TOKEN}`) return next();
  return requireAdminSession(req, res, next);
};

app.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));
app.get("/ready", async (_req, res) => {
  try {
    await repositoryReady;
    await userStoreReady;
    return res.json({ data: { status: "ready", database: repositoryKind } });
  } catch {
    return res.status(503).json({ error: { code: "NOT_READY", message: "数据库尚未就绪" } });
  }
});

app.post("/api/v1/auth/login", (req, res) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const attempts = loginAttempts.get(key);
  if (attempts && attempts.resetAt > now && attempts.count >= 10) return sendError(res, 429, "RATE_LIMITED", "登录尝试过于频繁，请稍后再试");
  if (!attempts || attempts.resetAt <= now) loginAttempts.set(key, { count: 1, resetAt: now + 60_000 });
  else attempts.count += 1;
  void (async () => {
    const user = await userStore.authenticate(String(req.body?.username ?? ""), String(req.body?.password ?? ""));
    if (!user) return sendError(res, 401, "ADMIN_UNAUTHORIZED", "管理员账号或密码错误");
    loginAttempts.delete(key);
    setSession(res, user.username, user.sessionVersion);
    return res.json({ data: { username: user.username } });
  })().catch(() => sendError(res, 500, "INTERNAL_ERROR", "登录服务暂时不可用"));
});
app.get("/api/v1/setup/status", async (_req, res, next) => { try { return res.json({ data: { required: !(await userStore.hasUsers()) } }); } catch (error) { return next(error); } });
app.post("/api/v1/setup/initialize", async (req, res, next) => {
  try {
    const input = z.object({ username: z.string().trim(), password: z.string() }).parse(req.body);
    validateNewUser(input.username, input.password);
    const user = await userStore.createFirstUser(input.username, input.password);
    setSession(res, user.username, user.sessionVersion);
    return res.status(201).json({ data: { username: user.username } });
  } catch (error) {
    if (error instanceof Error && /已初始化|用户名|密码/.test(error.message)) return sendError(res, 409, "SETUP_UNAVAILABLE", error.message);
    return next(error);
  }
});
app.post("/api/v1/auth/reset-password", async (req, res, next) => {
  try {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const attempts = recoveryAttempts.get(key);
    if (attempts && attempts.resetAt > now && attempts.count >= 5) return sendError(res, 429, "RATE_LIMITED", "恢复尝试过于频繁，请稍后再试");
    if (!attempts || attempts.resetAt <= now) recoveryAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    else attempts.count += 1;
    const input = z.object({ username: z.string().trim(), recoveryCode: z.string().trim().min(20).max(128), password: z.string() }).parse(req.body);
    validateNewUser(input.username, input.password);
    const success = await userStore.resetPassword(input.username, input.recoveryCode, input.password);
    if (!success) return sendError(res, 400, "INVALID_RECOVERY_CODE", "恢复码无效、已使用或已过期");
    await repository.recordAudit({ action: "auth.password.reset", actorType: "system", actorId: input.username });
    recoveryAttempts.delete(key);
    setSession(res, input.username, (await userStore.getSessionVersion(input.username)) ?? 0);
    return res.json({ data: { username: input.username } });
  } catch (error) { return next(error); }
});
app.post("/api/v1/auth/logout", (_req, res) => { clearSession(res); return res.json({ data: { ok: true } }); });
app.get("/api/v1/auth/me", requireAdminSession, (_req, res) => res.json({ data: { username: res.locals.adminUsername } }));

app.post("/api/v1/articles/upload", requireApiToken, async (req, res, next) => {
  try {
    const parsed = uploadArticleSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "文章字段校验失败", parsed.error.flatten());
    let uploadInput = parsed.data;
    if (uploadInput.briefId) {
      const context = await contentPlanningStore.getBriefContext(uploadInput.briefId);
      if (!context) return sendError(res, 404, "BRIEF_NOT_FOUND", "文章任务不存在");
      if ((uploadInput.seriesId && uploadInput.seriesId !== context.series.id) || (uploadInput.strategyId && uploadInput.strategyId !== context.strategy.id)) return sendError(res, 409, "BRIEF_RELATION_CONFLICT", "文章任务与内容战略/系列不匹配");
      uploadInput = { ...uploadInput, seriesId: context.series.id, strategyId: context.strategy.id };
    }
    const result = await repository.createOrGet(uploadInput);
    await repository.recordAudit({ action: result.created ? "article.upload" : "article.upload.idempotent", actorType: "api", articleId: result.article.id });
    const capabilities = await wechatProvider.getCapabilities();
    return res.status(result.created ? 201 : 200).json({ data: { article: result.article, created: result.created, capabilities } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/articles", requireAdminOrApiToken, async (req, res, next) => {
  try {
    const query = z.object({
      q: z.string().optional(),
      status: articleStatusSchema.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      includeArchived: z.coerce.boolean().default(false),
    }).parse(req.query);
    const result = await repository.list(query);
    return res.json({ data: result.items, meta: { page: query.page, pageSize: query.pageSize, total: result.total } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/articles/:id", requireAdminOrApiToken, async (req, res, next) => {
  try {
    const article = await repository.get(String(req.params.id));
    if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在");
    return res.json({ data: article });
  } catch (error) { return next(error); }
});

app.get("/api/v1/ai/articles", requireAiReadToken, async (req, res, next) => {
  try {
    const query = z.object({
      q: z.string().trim().max(200).optional(),
      source: z.string().trim().max(100).optional(),
      from: z.string().datetime({ offset: true }).optional(),
      to: z.string().datetime({ offset: true }).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      cursor: z.string().max(500).optional(),
    }).parse(req.query);
    const page = await repository.listAiArticles(query);
    return res.json({ data: { items: page.items.map((article) => toAiArticle(article, "text")), nextCursor: page.nextCursor, hasMore: page.hasMore, dataVersion: "published-v1" } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/ai/articles/:id", requireAiReadToken, async (req, res, next) => {
  try {
    const format = z.enum(["text", "html"]).default("text").parse(req.query.format);
    const article = await repository.getAiArticle(String(req.params.id));
    if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在");
    return res.json({ data: toAiArticle(article, format) });
  } catch (error) { return next(error); }
});

app.get("/api/v1/ai/content-plan/next", requireAiReadToken, async (_req, res, next) => {
  try { const context = await contentPlanningStore.getNextContext(); if (!context) return res.json({ data: null }); const related = await repository.listPlanArticles(context.strategy.id, context.series.id, 10); return res.json({ data: { ...context, relatedArticles: related.map((article) => ({ id: article.id, title: article.title, summary: article.summary, digest: article.digest, publishedAt: article.publishedAt })) } }); } catch (error) { return next(error); }
});
app.get("/api/v1/ai/content-plan/briefs/:id", requireAiReadToken, async (req, res, next) => {
  try { const context = await contentPlanningStore.getBriefContext(String(req.params.id)); if (!context || context.brief.status !== "planned" || context.series.status !== "active" || context.strategy.status !== "active") return sendError(res, 404, "NOT_FOUND", "内容任务不存在"); const related = await repository.listPlanArticles(context.strategy.id, context.series.id, 10); return res.json({ data: { ...context, relatedArticles: related.map((article) => ({ id: article.id, title: article.title, summary: article.summary, digest: article.digest, publishedAt: article.publishedAt })) } }); } catch (error) { return next(error); }
});

app.get("/api/v1/strategies", requireAdminOrApiToken, async (_req, res, next) => { try { return res.json({ data: await contentPlanningStore.listStrategies() }); } catch (error) { return next(error); } });
app.post("/api/v1/strategies", requireAdminSession, async (req, res, next) => { try { const item = await contentPlanningStore.createStrategy(contentStrategySchema.parse(req.body)); return res.status(201).json({ data: item }); } catch (error) { return next(error); } });
app.patch("/api/v1/strategies/:id", requireAdminSession, async (req, res, next) => { try { const values = contentStrategySchema.partial().extend({ status: strategyStatusSchema.optional() }).parse(req.body); const item = await contentPlanningStore.updateStrategy(String(req.params.id), values); if (!item) return sendError(res, 404, "NOT_FOUND", "内容战略不存在"); return res.json({ data: item }); } catch (error) { return next(error); } });
app.get("/api/v1/strategies/:id/series", requireAdminOrApiToken, async (req, res, next) => { try { return res.json({ data: await contentPlanningStore.listSeries(String(req.params.id)) }); } catch (error) { return next(error); } });
app.post("/api/v1/strategies/:id/series", requireAdminSession, async (req, res, next) => { try { const item = await contentPlanningStore.createSeries(String(req.params.id), contentSeriesSchema.parse(req.body)); return res.status(201).json({ data: item }); } catch (error) { return next(error); } });
app.patch("/api/v1/series/:id", requireAdminSession, async (req, res, next) => { try { const values = contentSeriesSchema.partial().extend({ status: strategyStatusSchema.optional() }).parse(req.body); const item = await contentPlanningStore.updateSeries(String(req.params.id), values); if (!item) return sendError(res, 404, "NOT_FOUND", "内容系列不存在"); return res.json({ data: item }); } catch (error) { return next(error); } });
app.get("/api/v1/series/:id/briefs", requireAdminOrApiToken, async (req, res, next) => { try { return res.json({ data: await contentPlanningStore.listBriefs(String(req.params.id)) }); } catch (error) { return next(error); } });
app.post("/api/v1/series/:id/briefs", requireAdminSession, async (req, res, next) => { try { const item = await contentPlanningStore.createBrief(String(req.params.id), contentBriefSchema.parse(req.body)); return res.status(201).json({ data: item }); } catch (error) { return next(error); } });
app.patch("/api/v1/briefs/:id", requireAdminSession, async (req, res, next) => { try { const values = contentBriefSchema.partial().extend({ status: briefStatusSchema.optional() }).parse(req.body); const item = await contentPlanningStore.updateBrief(String(req.params.id), values); if (!item) return sendError(res, 404, "NOT_FOUND", "文章任务不存在"); return res.json({ data: item }); } catch (error) { return next(error); } });

app.post("/api/v1/ai/articles/check-duplicate", requireAiReadToken, async (req, res, next) => {
  try {
    const input = z.object({
      title: z.string().trim().min(1).max(120),
      summary: z.string().trim().max(2_000).optional(),
      outline: z.array(z.string().trim().max(300)).max(30).optional(),
      topics: z.array(z.string().trim().max(100)).max(20).optional(),
      keywords: z.array(z.string().trim().max(100)).max(50).optional(),
      content: z.string().max(2_000_000).optional(),
    }).parse(req.body) as DuplicateInput;
    const result = checkDuplicate(input, await repository.listDedupCandidates());
    return res.json({ data: { ...result, advisory: true } });
  } catch (error) { return next(error); }
});

app.get("/api/v1/articles/:id/similar", requireAdminOrApiToken, async (req, res, next) => {
  try {
    const article = await repository.get(String(req.params.id));
    if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在");
    const result = checkDuplicate({ title: article.title, summary: article.summary, outline: article.outline, topics: article.topics, keywords: article.keywords, content: article.content }, (await repository.listDedupCandidates()).filter((candidate) => candidate.id !== article.id));
    return res.json({ data: result });
  } catch (error) { return next(error); }
});

app.post("/api/v1/articles/:id/:action", requireAdminSession, async (req, res, next) => {
  try {
    const action = z.enum(["archive", "restore"]).parse(String(req.params.action));
    const status = action === "archive" ? "archived" : "uploaded";
    const article = await repository.updateStatus(String(req.params.id), status);
    if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在");
    await repository.recordAudit({ action: `article.${action}`, actorType: "admin", actorId: res.locals.adminUsername, articleId: article.id });
    return res.json({ data: article });
  } catch (error) { return next(error); }
});

app.get("/api/v1/channels/wechat/capabilities", requireAdminSession, async (_req, res, next) => {
  try { return res.json({ data: await wechatProvider.getCapabilities() }); } catch (error) { return next(error); }
});

app.post("/api/v1/articles/:id/wechat/:action", requireAdminSession, async (req, res, next) => {
  try {
    const action = z.enum(["draft", "publish"]).parse(String(req.params.action));
    const draftId = z.object({ draftId: z.string().trim().min(1).optional() }).parse(req.body ?? {}).draftId;
    const article = await repository.get(String(req.params.id));
    if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在");
    const capabilities = await wechatProvider.getCapabilities();
    if ((action === "draft" && !capabilities.draft) || (action === "publish" && !capabilities.publish)) {
      return sendError(res, 403, "CHANNEL_CAPABILITY_UNAVAILABLE", capabilities.reason ?? "当前公众号不支持此操作");
    }
    const operation = await repository.createOperation(article.id, action);
    await repository.recordAudit({ action: `wechat.${action}`, actorType: "admin", actorId: res.locals.adminUsername, articleId: article.id, operationId: operation.id });
    void processChannelOperation(operation.id, article.id, action, draftId);
    return res.status(202).json({ data: operation });
  } catch (error) { return next(error); }
});

app.post("/api/v1/articles/:id/wechat/retry", requireAdminSession, async (req, res, next) => {
  try {
    const articleId = String(req.params.id);
    const article = await repository.get(articleId);
    if (!article) return sendError(res, 404, "NOT_FOUND", "文章不存在");
    const failed = await repository.getLatestFailedOperation(articleId);
    if (!failed) return sendError(res, 409, "NO_FAILED_OPERATION", "没有可重试的微信操作");
    const operation = await repository.createOperation(articleId, failed.action);
    void processChannelOperation(operation.id, articleId, failed.action, failed.externalId);
    return res.status(202).json({ data: operation });
  } catch (error) { return next(error); }
});

async function processChannelOperation(operationId: string, articleId: string, action: "draft" | "publish", draftId?: string) {
  try {
    const article = await repository.get(articleId);
    if (!article) throw new Error("文章不存在");
    const existingOperation = await repository.getOperation(operationId);
    const existingPublishId = action === "publish" ? existingOperation?.externalId : undefined;
    const result = action === "draft" ? await wechatProvider.createDraft(article) : { externalId: existingPublishId ?? (await wechatProvider.publish(article, draftId)).externalId };
    if (action === "draft") {
      await repository.completeOperation(operationId, "succeeded", { externalId: result.externalId });
      await repository.updateStatus(articleId, "draft_ready");
      return;
    }
    await repository.setOperationExternalId(operationId, result.externalId);
    await repository.updateStatus(articleId, "publish_pending");
    let publishStatus: "pending" | "succeeded" | "failed" = "pending";
    for (let attempt = 0; attempt < 5 && publishStatus === "pending"; attempt += 1) {
      publishStatus = await wechatProvider.getPublishStatus(result.externalId);
      if (publishStatus === "pending") await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (publishStatus !== "succeeded") throw new Error(publishStatus === "failed" ? "微信公众号发布失败" : "微信公众号发布状态确认超时");
    await repository.confirmPublish(articleId, result.externalId, new Date().toISOString());
    await repository.completeOperation(operationId, "succeeded", { externalId: result.externalId });
  } catch (error) {
    await repository.completeOperation(operationId, "failed", { errorMessage: error instanceof Error ? error.message : "渠道操作失败" });
    await repository.updateStatus(articleId, "sync_failed");
    await repository.recordAudit({ action: `wechat.${action}.failed`, actorType: "system", articleId, operationId, success: false });
  }
}

export async function resumePendingOperations() {
  const pending = await repository.listPendingOperations();
  for (const operation of pending) void processChannelOperation(operation.id, operation.articleId, operation.action, operation.externalId);
}

app.get("/api/v1/operations/:id", requireAdminOrApiToken, async (req, res, next) => {
  try {
    const operation = await repository.getOperation(String(req.params.id));
    if (!operation) return sendError(res, 404, "NOT_FOUND", "操作不存在");
    return res.json({ data: operation });
  } catch (error) { return next(error); }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const requestId = randomUUID();
  const message = error instanceof Error ? error.message : "unknown error";
  const databaseCode = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
  if (databaseCode === "23503" || message.includes("不存在")) return sendError(res, 404, "NOT_FOUND", message);
  if (databaseCode === "23505" || message.includes("已存在")) return sendError(res, 409, "CONFLICT", message);
  console.error(JSON.stringify({ level: "error", requestId, message }));
  return sendError(res, 500, "INTERNAL_ERROR", "服务暂时不可用", { requestId });
});

export { app };
