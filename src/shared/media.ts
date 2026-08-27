import { z } from "zod";

/** 素材库首版只保存图片，状态通过归档实现软删除。 */
export const mediaAssetKindSchema = z.literal("image");
export const mediaAssetStatusSchema = z.enum(["active", "archived"]);
export type MediaAssetKind = z.infer<typeof mediaAssetKindSchema>;
export type MediaAssetStatus = z.infer<typeof mediaAssetStatusSchema>;

export const mediaMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type MediaMimeType = typeof mediaMimeTypes[number];
export const mediaMimeTypeSchema = z.enum(mediaMimeTypes);

export const mediaAssetUpdateSchema = z.object({
  alt: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  status: mediaAssetStatusSchema.optional(),
}).strict();

export interface MediaAsset {
  id: string;
  kind: MediaAssetKind;
  originalName: string;
  storageKey: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
  width?: number;
  height?: number;
  alt?: string;
  tags: string[];
  status: MediaAssetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAssetListQuery {
  q?: string;
  tag?: string;
  status?: MediaAssetStatus;
  page: number;
  pageSize: number;
}
