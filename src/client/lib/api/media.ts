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
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // 网关返回 HTML/纯文本时保留 HTTP 状态，避免把 JSON 解析异常直接暴露给用户。
    }
    if (!response.ok) {
      const message =
        typeof body === "object" && body !== null && "error" in body &&
        typeof body.error === "object" && body.error !== null && "message" in body.error &&
        typeof body.error.message === "string"
          ? body.error.message
          : `上传素材失败 (${response.status})`;
      throw new Error(message);
    }
    return body as { data: MediaAsset };
  },
};
