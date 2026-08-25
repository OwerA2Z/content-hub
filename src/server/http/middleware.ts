import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { requireAdminSession } from "../auth";
import { tokenStore } from "../tokens";
import { sendError } from "./errors";

export const requireApiToken = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  const supplied = header?.replace(/^Bearer\s+/i, "") ?? "";
  const envMatch = header === `Bearer ${config.API_TOKEN}`;
  if (!envMatch && !(supplied && await tokenStore.verify("api", supplied))) return sendError(res, 401, "UNAUTHORIZED", "需要有效的 Bearer Token");
  next();
};

export const requireAdminOrApiToken = async (req: Request, res: Response, next: NextFunction) => {
  const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (req.header("authorization") === `Bearer ${config.API_TOKEN}` || (supplied && await tokenStore.verify("api", supplied))) return next();
  return requireAdminSession(req, res, next);
};
