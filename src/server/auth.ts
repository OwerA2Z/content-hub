import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config";
import { userStore } from "./users";

const cookieName = "article_admin_session";

function sign(value: string) {
  return createHmac("sha256", config.SESSION_SECRET).update(value).digest("hex");
}

export function createSession(username: string, sessionVersion = 0) {
  const payload = Buffer.from(JSON.stringify({ username, sessionVersion, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSession(value?: string) {
  if (!value) return undefined;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return undefined;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { username?: string; sessionVersion?: number; exp?: number };
    return parsed.username && parsed.exp && parsed.exp > Date.now() ? { username: parsed.username, sessionVersion: parsed.sessionVersion ?? 0, exp: parsed.exp } : undefined;
  } catch { return undefined; }
}

export function setSession(res: Response, username: string, sessionVersion = 0) {
  res.setHeader("Set-Cookie", `${cookieName}=${createSession(username, sessionVersion)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export function clearSession(res: Response) {
  res.setHeader("Set-Cookie", `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export async function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  const cookie = req.header("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${cookieName}=`));
  const session = readSession(cookie?.slice(cookieName.length + 1));
  if (!session) return res.status(401).json({ error: { code: "ADMIN_UNAUTHORIZED", message: "请先登录后台" } });
  try {
    const currentVersion = await userStore.getSessionVersion(session.username);
    if (currentVersion === undefined || currentVersion !== (session.sessionVersion ?? 0)) return res.status(401).json({ error: { code: "ADMIN_UNAUTHORIZED", message: "登录已失效，请重新登录" } });
    res.locals.adminUsername = session.username;
    next();
  } catch {
    return res.status(503).json({ error: { code: "AUTH_UNAVAILABLE", message: "认证服务暂时不可用" } });
  }
}
