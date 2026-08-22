export interface Article {
  id: string;
  title: string;
  digest?: string;
  author?: string;
  status: string;
  createdAt: string;
  content: string;
  coverUrl?: string;
}

export interface Capabilities { draft: boolean; publish: boolean; reason?: string; }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "请求失败");
  return body;
}

export const api = {
  setupStatus: () => request<{ data: { required: boolean } }>("/api/v1/setup/status"),
  initialize: (username: string, password: string) => request<{ data: { username: string } }>("/api/v1/setup/initialize", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) => request<{ data: { username: string } }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ data: { ok: boolean } }>("/api/v1/auth/logout", { method: "POST" }),
  resetPassword: (username: string, recoveryCode: string, password: string) => request<{ data: { username: string } }>("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify({ username, recoveryCode, password }) }),
  me: () => request<{ data: { username: string } }>("/api/v1/auth/me"),
  listArticles: (params = "") => request<{ data: Article[]; meta: { total: number } }>(`/api/v1/articles${params}`),
  getArticle: (id: string) => request<{ data: Article }>(`/api/v1/articles/${id}`),
  archiveArticle: (id: string) => request<{ data: Article }>(`/api/v1/articles/${id}/archive`, { method: "POST" }),
  restoreArticle: (id: string) => request<{ data: Article }>(`/api/v1/articles/${id}/restore`, { method: "POST" }),
  getCapabilities: () => request<{ data: Capabilities }>("/api/v1/channels/wechat/capabilities"),
  createDraft: (id: string) => request<{ data: { id: string; status: string; externalId?: string } }>(`/api/v1/articles/${id}/wechat/draft`, { method: "POST" }),
  publish: (id: string, draftId: string) => request<{ data: { id: string; status: string; externalId?: string } }>(`/api/v1/articles/${id}/wechat/publish`, { method: "POST", body: JSON.stringify({ draftId }) }),
  getOperation: (id: string) => request<{ data: { id: string; status: string; externalId?: string; errorMessage?: string } }>(`/api/v1/operations/${id}`),
  retry: (id: string) => request<{ data: { id: string; status: string } }>(`/api/v1/articles/${id}/wechat/retry`, { method: "POST" }),
};
