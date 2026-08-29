import { request } from "../http";
import type { Brief, Series, Strategy } from "./types";

export const planningApi = {
  listStrategies: () => request<{ data: Strategy[] }>("/api/v1/strategies"),
  createStrategy: (input: object) => request<{ data: Strategy }>("/api/v1/strategies", { method: "POST", body: JSON.stringify(input) }),
  updateStrategy: (id: string, input: object) => request<{ data: Strategy }>(`/api/v1/strategies/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  listSeries: (strategyId: string) => request<{ data: Series[] }>(`/api/v1/strategies/${strategyId}/series`),
  createSeries: (strategyId: string, input: object) => request<{ data: Series }>(`/api/v1/strategies/${strategyId}/series`, { method: "POST", body: JSON.stringify(input) }),
  updateSeries: (id: string, input: object) => request<{ data: Series }>(`/api/v1/series/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  listBriefs: (seriesId: string) => request<{ data: Brief[] }>(`/api/v1/series/${seriesId}/briefs`),
  createBrief: (seriesId: string, input: object) => request<{ data: Brief }>(`/api/v1/series/${seriesId}/briefs`, { method: "POST", body: JSON.stringify(input) }),
  updateBrief: (id: string, input: object) => request<{ data: Brief }>(`/api/v1/briefs/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
};
