import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { MediaMimeType } from "../shared/media";
import { config } from "./config";

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

const extensionByMime: Record<MediaMimeType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function mediaRoot() {
  return resolve(config.MEDIA_ROOT);
}

export function validateMediaFile(file: { originalname: string; mimetype: string; size: number }) {
  if (!(file.mimetype in extensionByMime)) throw mediaError(400, "UNSUPPORTED_MEDIA_TYPE", "仅支持 JPG、PNG、WebP 和 GIF 图片");
  if (file.size <= 0) throw mediaError(400, "EMPTY_MEDIA", "素材文件不能为空");
  if (file.size > MEDIA_MAX_BYTES) throw mediaError(413, "MEDIA_TOO_LARGE", "图片不能超过 10MB");
  const extension = extname(file.originalname).toLowerCase();
  const expected = extensionByMime[file.mimetype as MediaMimeType];
  const acceptedExtensions = expected === ".jpg" ? [".jpg", ".jpeg"] : [expected];
  if (extension && !acceptedExtensions.includes(extension)) throw mediaError(400, "MEDIA_EXTENSION_MISMATCH", "图片扩展名与 MIME 类型不匹配");
  return file.mimetype as MediaMimeType;
}

export function validateMediaSignature(buffer: Buffer, mimeType: MediaMimeType) {
  const matches = mimeType === "image/png" ? buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    : mimeType === "image/jpeg" ? buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : mimeType === "image/gif" ? buffer.subarray(0, 6).toString("ascii").startsWith("GIF8")
        : buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!matches) throw mediaError(400, "INVALID_MEDIA_CONTENT", "图片内容与声明的格式不匹配");
}

/** 将上传内容写入临时文件后原子移动，避免读取到半文件。 */
export async function saveMediaBuffer(buffer: Buffer, mimeType: MediaMimeType) {
  if (buffer.length > MEDIA_MAX_BYTES) throw mediaError(413, "MEDIA_TOO_LARGE", "图片不能超过 10MB");
  const extension = extensionByMime[mimeType];
  const storageKey = `${new Date().toISOString().slice(0, 7).replace("-", "/")}/${randomUUID()}${extension}`;
  const destination = safeMediaPath(storageKey);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(temporary, buffer, { flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return { storageKey, sizeBytes: buffer.length };
}

export async function readMediaFile(storageKey: string) {
  return readFile(safeMediaPath(storageKey));
}

export async function removeMediaFile(storageKey: string) {
  await rm(safeMediaPath(storageKey), { force: true });
}

export function safeMediaPath(storageKey: string) {
  // 即使规范化后仍在根目录内，也拒绝显式的 .. 片段，避免路径语义被误用。
  if (!storageKey || isAbsolute(storageKey) || storageKey.split(/[\\/]/).includes("..")) throw mediaError(400, "INVALID_STORAGE_KEY", "素材路径无效");
  const root = mediaRoot();
  const target = resolve(join(root, storageKey));
  const fromRoot = relative(root, target);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw mediaError(400, "INVALID_STORAGE_KEY", "素材路径无效");
  return target;
}

export function publicMediaUrl(id: string) {
  return `/media/assets/${encodeURIComponent(id)}/content`;
}

export function mediaError(status: number, code: string, message: string) {
  const error = new Error(message);
  Object.assign(error, { status, code });
  return error;
}
