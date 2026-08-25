import { request } from "../http";
import type { CandidatePool, ContentCandidate, Article } from "./types";

export const candidateApi = {
  daily: () => request<{ data: { pool: CandidatePool; candidates: ContentCandidate[] } }>("/api/v1/candidate-pools/daily"),
  recheck: () => request<{ data: { pool: ContentCandidate[] } }>("/api/v1/ai/candidate-pools/daily/recheck", { method: "POST" }),
  accept: (id: string) => request<{ data: { candidate: ContentCandidate; article: Article; created: boolean } }>(`/api/v1/candidate-pools/daily/candidates/${id}/accept`, { method: "POST" }),
};
