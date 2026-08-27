import { z } from "zod";

export const candidateStatusSchema = z.enum(["candidate", "recommended", "accepted", "stale", "rejected"]);
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;

export const candidatePoolStatusSchema = z.enum(["open", "closed"]);
export type CandidatePoolStatus = z.infer<typeof candidatePoolStatusSchema>;

export const candidateInputSchema = z.object({
  externalId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(120),
  content: z.string().min(1).max(2_000_000),
  contentFormat: z.literal("html").default("html"),
  author: z.string().trim().max(100).optional(),
  digest: z.string().trim().max(300).optional(),
  summary: z.string().trim().max(2_000).optional(),
  outline: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  topics: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  keywords: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  coverUrl: z.string().url().max(2_000).optional(),
  coverAssetId: z.string().uuid().optional(),
  source: z.string().trim().max(100).optional(),
  strategyId: z.string().uuid().optional(),
  seriesId: z.string().uuid().optional(),
  briefId: z.string().uuid().optional(),
});
export type CandidateInput = z.infer<typeof candidateInputSchema>;

export interface CandidatePool { id: string; poolDate: string; timezone: string; status: CandidatePoolStatus; version: number; lastEvaluatedAt?: string; createdAt: string; updatedAt: string; }
export interface ContentCandidate extends CandidateInput { id: string; poolId: string; status: CandidateStatus; similarity: number; score: number; risk: "low" | "medium" | "high" | "exact"; warnings: string[]; matchedArticleId?: string; createdAt: string; updatedAt: string; acceptedArticleId?: string; }
