import { request } from "../http";
import type { MediaAsset } from "./types";

export const mediaApi = {
  list: (params = "") => request<{ data: MediaAsset[]; meta: { total: number } }>(`/api/v1/media/assets${params}`),
  get: (id: string) => request<{ data: MediaAsset }>(`/api/v1/media/assets/${id}`),
  update: (id: string, input: { alt?: string; tags?: string[]; status?: "active" | "archived" }) => request<{ data: MediaAsset }>(`/api/v1/media/assets/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<{ data: MediaAsset }>(`/api/v1/media/assets/${id}`, { method: "DELETE" }),
  upload: async (file: File, tags: string[] = [], alt = "") => {
    const form = new FormData(); form.append("file", file); form.append("tags", JSON.stringify(tags)); if (alt) form.append("alt", alt);
    const response = await fetch("/api/v1/media/assets", { method: "POST", credentials: "include", body: form });
    const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "上传素材失败"); return body as { data: MediaAsset };
  },
};
