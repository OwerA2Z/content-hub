import { request } from "../http";
import type { Article, Capabilities } from "./types";

export const articleApi = {
  list: (params = "") => request<{ data: Article[]; meta: { total: number } }>(`/api/v1/articles${params}`),
  get: (id: string) => request<{ data: Article }>(`/api/v1/articles/${id}`),
  archive: (id: string) => request<{ data: Article }>(`/api/v1/articles/${id}/archive`, { method: "POST" }),
  restore: (id: string) => request<{ data: Article }>(`/api/v1/articles/${id}/restore`, { method: "POST" }),
  capabilities: () => request<{ data: Capabilities }>("/api/v1/channels/wechat/capabilities"),
  createDraft: (id: string) => request<{ data: { id: string; status: string; externalId?: string } }>(`/api/v1/articles/${id}/wechat/draft`, { method: "POST" }),
  publish: (id: string, draftId: string) => request<{ data: { id: string; status: string; externalId?: string } }>(`/api/v1/articles/${id}/wechat/publish`, { method: "POST", body: JSON.stringify({ draftId }) }),
  getOperation: (id: string) => request<{ data: { id: string; status: string; externalId?: string; errorMessage?: string } }>(`/api/v1/operations/${id}`),
  retry: (id: string) => request<{ data: { id: string; status: string } }>(`/api/v1/articles/${id}/wechat/retry`, { method: "POST" }),
};
