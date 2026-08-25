import { request } from "../http";
import type { CreatedToken, TokenInfo } from "./types";

export const adminTokenApi = {
  list: () => request<{ data: TokenInfo[] }>("/api/v1/admin/tokens"),
  create: (name: string, kind: TokenInfo["kind"]) => request<{ data: CreatedToken }>("/api/v1/admin/tokens", { method: "POST", body: JSON.stringify({ name, kind }) }),
  revoke: (id: string) => request<{ data: { revoked: boolean } }>(`/api/v1/admin/tokens/${id}/revoke`, { method: "POST" }),
};
