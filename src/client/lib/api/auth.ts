import { request } from "../http";

export const authApi = {
  setupStatus: () => request<{ data: { required: boolean } }>("/api/v1/setup/status"),
  initialize: (username: string, password: string) => request<{ data: { username: string } }>("/api/v1/setup/initialize", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) => request<{ data: { username: string } }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ data: { ok: boolean } }>("/api/v1/auth/logout", { method: "POST" }),
  resetPassword: (username: string, recoveryCode: string, password: string) => request<{ data: { username: string } }>("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify({ username, recoveryCode, password }) }),
  me: () => request<{ data: { username: string } }>("/api/v1/auth/me"),
};
