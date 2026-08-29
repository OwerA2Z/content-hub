import { request } from "../http";
import type { CreatedToken, TokenInfo } from "./types";
import type { TokenScope } from "../../../shared/scopes";

export const adminTokenApi = {
  list: () => request<{ data: TokenInfo[] }>("/api/v1/admin/tokens"),
  create: (name: string, scopes: readonly TokenScope[]) => request<{ data: CreatedToken }>("/api/v1/admin/tokens", { method: "POST", body: JSON.stringify({ name, scopes }) }),
  updateScopes: (id: string, scopes: readonly TokenScope[]) => request<{ data: TokenInfo }>(`/api/v1/admin/tokens/${id}`, { method: "PATCH", body: JSON.stringify({ scopes }) }),
  revoke: (id: string) => request<{ data: { revoked: boolean } }>(`/api/v1/admin/tokens/${id}/revoke`, { method: "POST" }),
};
