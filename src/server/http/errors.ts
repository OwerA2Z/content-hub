import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { ApiErrorBody } from "../../shared/contracts";

export function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  res.status(status).json(body);
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const requestId = randomUUID();
  const message = error instanceof Error ? error.message : "unknown error";
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : undefined;
  const code = typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : undefined;
  const details = typeof error === "object" && error && "details" in error ? error.details : undefined;
  if (status) return sendError(res, status, code ?? "REQUEST_ERROR", message, details);
  const databaseCode = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
  if (databaseCode === "23503" || message.includes("不存在")) return sendError(res, 404, "NOT_FOUND", message);
  if (databaseCode === "23505" || message.includes("已存在")) return sendError(res, 409, "CONFLICT", message);
  console.error(JSON.stringify({ level: "error", requestId, message }));
  return sendError(res, 500, "INTERNAL_ERROR", "服务暂时不可用", { requestId });
}
