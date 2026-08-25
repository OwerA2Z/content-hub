import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository";
import { clearSession, requireAdminSession, setSession } from "../auth";
import { userStore, validateNewUser } from "../users";
import { sendError } from "../http/errors";

export function createAuthRouter() {
  const router = Router();
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  const recoveryAttempts = new Map<string, { count: number; resetAt: number }>();

  router.post("/auth/login", (req, res) => {
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

  router.get("/setup/status", async (_req, res, next) => { try { return res.json({ data: { required: !(await userStore.hasUsers()) } }); } catch (error) { return next(error); } });
  router.post("/setup/initialize", async (req, res, next) => {
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

  router.post("/auth/reset-password", async (req, res, next) => {
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

  router.post("/auth/logout", (_req, res) => { clearSession(res); return res.json({ data: { ok: true } }); });
  router.get("/auth/me", requireAdminSession, (_req, res) => res.json({ data: { username: res.locals.adminUsername } }));
  return router;
}
