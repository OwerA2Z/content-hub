import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { requireAdminSession } from "../auth";
import { normalizeScopes, tokenStore, type TokenScope } from "../tokens";
import { sendError } from "./errors";

const configuredApiScopes = normalizeScopes(config.API_TOKEN_SCOPES.split(","));
const aiRequests = new Map<string, { count: number; resetAt: number }>();

function bearerToken(req: Request) {
  return req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}

async function hasScopes(req: Request, requiredScopes: readonly TokenScope[]) {
  const supplied = bearerToken(req);
  if (!supplied) return false;
  if (req.header("authorization") === `Bearer ${config.API_TOKEN}`) return requiredScopes.every((scope) => configuredApiScopes.includes(scope));
  return tokenStore.verify(supplied, requiredScopes);
}

export const requireScopes = (requiredScopes: readonly TokenScope[]) => async (req: Request, res: Response, next: NextFunction) => {
  if (!(await hasScopes(req, requiredScopes))) return sendError(res, 401, "INSUFFICIENT_SCOPE", `需要权限：${requiredScopes.join(", ")}`);
  res.locals.authActorType = "api";
  next();
};

export const requireAiScopes = (requiredScopes: readonly TokenScope[]) => async (req: Request, res: Response, next: NextFunction) => {
  if (!(await hasScopes(req, requiredScopes))) return sendError(res, 401, "INSUFFICIENT_SCOPE", `需要权限：${requiredScopes.join(", ")}`);
  res.locals.authActorType = "api";
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const usage = aiRequests.get(key);
  if (usage && usage.resetAt > now && usage.count >= 120) return sendError(res, 429, "RATE_LIMITED", "AI 请求过于频繁");
  if (!usage || usage.resetAt <= now) aiRequests.set(key, { count: 1, resetAt: now + 60_000 });
  else usage.count += 1;
  next();
};

export const requireAdminOrScopes = (requiredScopes: readonly TokenScope[]) => async (req: Request, res: Response, next: NextFunction) => {
  if (await hasScopes(req, requiredScopes)) { res.locals.authActorType = "api"; return next(); }
  return requireAdminSession(req, res, next);
};

export const requireApiToken = requireScopes(["articles:write"]);
