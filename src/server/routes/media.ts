import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { mediaAssetStatusSchema, mediaAssetUpdateSchema } from "../../shared/media";
import { mediaAssetRepository } from "../media-library";
import { MEDIA_MAX_BYTES, mediaError, publicMediaUrl, readMediaFile, removeMediaFile, saveMediaBuffer, validateMediaFile, validateMediaSignature } from "../media-storage";
import { requireAdminOrScopes } from "../http/middleware";
import { repository } from "../db/repository";
import { sendError } from "../http/errors";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MEDIA_MAX_BYTES, files: 1 } });

function parseTags(value: unknown) {
  if (value === undefined || value === "") return [];
  if (Array.isArray(value)) return z.array(z.string().trim().min(1).max(50)).max(30).parse(value);
  if (typeof value !== "string") throw mediaError(400, "INVALID_TAGS", "tags 必须是 JSON 数组或逗号分隔文本");
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return z.array(z.string().trim().min(1).max(50)).max(30).parse(parsed);
  } catch { /* 兼容 multipart 的逗号分隔写法。 */ }
  return z.array(z.string().trim().min(1).max(50)).max(30).parse(value.split(","));
}

function serialize(asset: Awaited<ReturnType<typeof mediaAssetRepository.get>>, req?: Request) {
  if (!asset) return asset;
  // storageKey 只供服务端读取文件，不能随接口暴露内部目录结构。
  const { storageKey: _storageKey, ...publicAsset } = asset;
  const relativeUrl = publicMediaUrl(asset.id);
  const baseUrl = req ? `${req.protocol}://${req.get("host")}` : "";
  return { ...publicAsset, url: `${baseUrl}${relativeUrl}`, contentUrl: `${baseUrl}${relativeUrl}` };
}

function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return sendError(res, 413, "MEDIA_TOO_LARGE", "图片不能超过 10MB");
    if (error instanceof multer.MulterError) return sendError(res, 400, "MEDIA_UPLOAD_INVALID", "素材上传格式无效");
    return next(error);
  });
}

function assetId(req: Request) {
  const parsed = z.string().uuid().safeParse(String(req.params.id));
  if (!parsed.success) throw mediaError(400, "INVALID_MEDIA_ID", "素材 ID 无效");
  return parsed.data;
}

export function createMediaApiRouter() {
  const router = Router();
  router.get("/assets", requireAdminOrScopes(["media:read"]), async (req, res, next) => {
    try {
      const query = z.object({ q: z.string().trim().max(200).optional(), tag: z.string().trim().max(50).optional(), status: mediaAssetStatusSchema.optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(24) }).parse(req.query);
      const result = await mediaAssetRepository.list(query);
      return res.json({ data: result.items.map((asset) => serialize(asset, req)), meta: { page: query.page, pageSize: query.pageSize, total: result.total } });
    } catch (error) { return next(error); }
  });
  router.post("/assets", requireAdminOrScopes(["media:write"]), uploadSingle, async (req, res, next) => {
    try {
      if (!req.file) return sendError(res, 400, "MEDIA_FILE_REQUIRED", "请选择要上传的图片文件");
      const mimeType = validateMediaFile(req.file);
      validateMediaSignature(req.file.buffer, mimeType);
      const stored = await saveMediaBuffer(req.file.buffer, mimeType);
      try {
        const asset = await mediaAssetRepository.create({ originalName: req.file.originalname.slice(0, 255), storageKey: stored.storageKey, mimeType, sizeBytes: stored.sizeBytes, alt: typeof req.body.alt === "string" ? req.body.alt.trim().slice(0, 500) : undefined, tags: parseTags(req.body.tags) });
        await repository.recordAudit({ action: "media.asset.create", actorType: res.locals.authActorType ?? "admin", actorId: res.locals.adminUsername });
        return res.status(201).json({ data: serialize(asset, req) });
      } catch (error) {
        // 元数据写入失败时清理刚写入的文件，避免产生无法管理的孤儿文件。
        await removeMediaFile(stored.storageKey).catch(() => undefined);
        return next(error);
      }
    } catch (error) { return next(error); }
  });
  router.get("/assets/:id", requireAdminOrScopes(["media:read"]), async (req, res, next) => {
    try { const asset = await mediaAssetRepository.get(assetId(req)); if (!asset) return sendError(res, 404, "NOT_FOUND", "素材不存在"); return res.json({ data: serialize(asset, req) }); } catch (error) { return next(error); }
  });
  router.patch("/assets/:id", async (req, res, next) => {
    const input = mediaAssetUpdateSchema.safeParse(req.body);
    if (!input.success) return sendError(res, 400, "VALIDATION_ERROR", "素材字段校验失败", input.error.flatten());
    const middleware = input.data.status === "archived" ? requireAdminOrScopes(["media:delete"]) : requireAdminOrScopes(["media:write"]);
    return middleware(req, res, async (error?: unknown) => {
      if (error) return next(error);
      try { const asset = await mediaAssetRepository.update(assetId(req), input.data); if (!asset) return sendError(res, 404, "NOT_FOUND", "素材不存在"); await repository.recordAudit({ action: "media.asset.update", actorType: res.locals.authActorType ?? "admin", actorId: res.locals.adminUsername }); return res.json({ data: serialize(asset, req) }); } catch (caught) { return next(caught); }
    });
  });
  router.delete("/assets/:id", requireAdminOrScopes(["media:delete"]), async (req, res, next) => {
    try { const asset = await mediaAssetRepository.archive(assetId(req)); if (!asset) return sendError(res, 404, "NOT_FOUND", "素材不存在"); await repository.recordAudit({ action: "media.asset.archive", actorType: res.locals.authActorType ?? "admin", actorId: res.locals.adminUsername }); return res.json({ data: serialize(asset, req) }); } catch (error) { return next(error); }
  });
  return router;
}

export function createMediaContentRouter() {
  const router = Router();
  router.get("/assets/:id/content", requireAdminOrScopes(["media:read"]), async (req, res, next) => {
    try {
      const asset = await mediaAssetRepository.get(assetId(req));
      if (!asset || asset.status !== "active") return sendError(res, 404, "NOT_FOUND", "素材不存在或已归档");
      const content = await readMediaFile(asset.storageKey);
      res.setHeader("Content-Type", asset.mimeType);
      res.setHeader("Content-Length", String(content.byteLength));
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.send(content);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return sendError(res, 404, "MEDIA_FILE_MISSING", "素材文件不存在");
      return next(error);
    }
  });
  return router;
}
