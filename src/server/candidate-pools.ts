import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { checkDuplicate, compareArticle, contentHash, type DuplicateResult } from "./dedup";
import { repository } from "./db/repository";
import { config } from "./config";
import type { Article } from "../shared/contracts";
import type { CandidateInput, CandidatePool, CandidateStatus, ContentCandidate } from "../shared/candidate-pools";

const timezone = "Asia/Shanghai";
const now = () => new Date().toISOString();

export function currentPoolDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function candidateArticle(candidate: ContentCandidate): Article {
  return { id: candidate.id, title: candidate.title, content: candidate.content, contentFormat: "html", author: candidate.author, digest: candidate.digest, coverUrl: candidate.coverUrl, images: [], metadata: {}, summary: candidate.summary, outline: candidate.outline ?? [], topics: candidate.topics ?? [], keywords: candidate.keywords ?? [], contentHash: contentHash(candidate.content), status: "uploaded", createdAt: candidate.createdAt, updatedAt: candidate.updatedAt, publishConfirmed: false };
}

function evaluateCandidate(candidate: ContentCandidate, storedArticles: Article[], peerCandidates: ContentCandidate[]) {
  const duplicate = checkDuplicate({ title: candidate.title, summary: candidate.summary, outline: candidate.outline, topics: candidate.topics, keywords: candidate.keywords, content: candidate.content }, storedArticles);
  const peerArticles = peerCandidates.filter((peer) => peer.id !== candidate.id).map(candidateArticle);
  const peerComparisons = peerArticles.map((article) => compareArticle({ title: candidate.title, summary: candidate.summary, outline: candidate.outline, topics: candidate.topics, keywords: candidate.keywords, content: candidate.content }, article)).sort((left, right) => right.similarity - left.similarity);
  const peerBest = peerComparisons[0];
  const similarity = Math.max(duplicate.similarity, peerBest?.similarity ?? 0);
  const completeness = [candidate.summary, candidate.outline?.length, candidate.topics?.length, candidate.keywords?.length].filter((value) => value).length / 4;
  const score = Number(((1 - similarity) * 0.7 + completeness * 0.3).toFixed(4));
  const warnings = [...duplicate.warnings];
  if (peerBest && peerBest.similarity >= 0.45) warnings.push(`与本日候选《${peerBest.title}》存在主题重合，建议只保留一个角度。`);
  if (!candidate.summary) warnings.push("缺少文章梗概，建议补充后再生成。");
  const risk: ContentCandidate["risk"] = duplicate.exactDuplicate ? "exact" : similarity > 0.75 ? "high" : similarity >= 0.45 ? "medium" : "low";
  return { similarity, score, risk, warnings, matchedArticleId: duplicate.candidates[0]?.articleId, status: risk === "exact" ? "stale" as const : candidate.status };
}

function applyRanking(candidates: ContentCandidate[]) {
  const ranked = [...candidates].filter((candidate) => !["accepted", "rejected", "stale"].includes(candidate.status)).sort((left, right) => right.score - left.score);
  const recommended = new Set(ranked.slice(0, 3).map((candidate) => candidate.id));
  return candidates.map((candidate) => ({ ...candidate, status: candidate.status === "accepted" || candidate.status === "rejected" || candidate.status === "stale" ? candidate.status : recommended.has(candidate.id) ? "recommended" : "candidate" as CandidateStatus, updatedAt: now() }));
}

export interface CandidatePoolStore {
  getDaily(): Promise<{ pool: CandidatePool; candidates: ContentCandidate[] }>;
  submit(date: string, inputs: CandidateInput[]): Promise<ContentCandidate[]>;
  recheck(date?: string): Promise<ContentCandidate[]>;
  getCandidate(id: string): Promise<ContentCandidate | undefined>;
  accept(id: string, articleId: string): Promise<ContentCandidate | undefined>;
}

export class MemoryCandidatePoolStore implements CandidatePoolStore {
  private pools = new Map<string, CandidatePool>();
  private candidates = new Map<string, ContentCandidate>();
  private ensure(date: string) { const existing = this.pools.get(date); if (existing) return existing; for (const [key, pool] of this.pools) if (key < date && pool.status === "open") this.pools.set(key, { ...pool, status: "closed", updatedAt: now() }); const pool: CandidatePool = { id: randomUUID(), poolDate: date, timezone, status: "open", version: 1, createdAt: now(), updatedAt: now() }; this.pools.set(date, pool); return pool; }
  async getDaily() { const pool = this.ensure(currentPoolDate()); return { pool, candidates: [...this.candidates.values()].filter((candidate) => candidate.poolId === pool.id).sort((left, right) => right.score - left.score) }; }
  async submit(date: string, inputs: CandidateInput[]) { const pool = this.ensure(date); const result: ContentCandidate[] = []; for (const input of inputs) { const existing = [...this.candidates.values()].find((candidate) => candidate.poolId === pool.id && candidate.externalId === input.externalId); if (existing) { result.push(existing); continue; } const candidate: ContentCandidate = { ...input, id: randomUUID(), poolId: pool.id, outline: input.outline ?? [], topics: input.topics ?? [], keywords: input.keywords ?? [], status: "candidate", similarity: 0, score: 0, risk: "low", warnings: [], createdAt: now(), updatedAt: now() }; this.candidates.set(candidate.id, candidate); result.push(candidate); } return this.recheck(date).then((items) => items.filter((item) => result.some((submitted) => submitted.id === item.id))); }
  async recheck(date = currentPoolDate()) { const pool = this.ensure(date); const stored = await repository.listDedupCandidates(); const candidates = [...this.candidates.values()].filter((candidate) => candidate.poolId === pool.id); const evaluated = candidates.map((candidate) => ({ ...candidate, ...evaluateCandidate(candidate, stored, candidates) })); const ranked = applyRanking(evaluated); ranked.forEach((candidate) => this.candidates.set(candidate.id, candidate)); const updatedPool = { ...pool, version: pool.version + 1, lastEvaluatedAt: now(), updatedAt: now() }; this.pools.set(date, updatedPool); return ranked.sort((left, right) => right.score - left.score); }
  async getCandidate(id: string) { return this.candidates.get(id); }
  async accept(id: string, articleId: string) { const candidate = this.candidates.get(id); if (!candidate) return undefined; const updated = { ...candidate, status: "accepted" as const, acceptedArticleId: articleId, updatedAt: now() }; this.candidates.set(id, updated); return updated; }
}

type CandidateRow = { id: string; pool_id: string; external_id: string; title: string; content: string; content_format: "html"; author: string | null; digest: string | null; summary: string | null; outline: string[]; topics: string[]; keywords: string[]; cover_url: string | null; source: string | null; strategy_id: string | null; series_id: string | null; brief_id: string | null; status: CandidateStatus; similarity: number; score: number; risk: ContentCandidate["risk"]; warnings: string[]; matched_article_id: string | null; accepted_article_id: string | null; created_at: Date; updated_at: Date; };

function toCandidate(row: CandidateRow): ContentCandidate { return { id: row.id, poolId: row.pool_id, externalId: row.external_id, title: row.title, content: row.content, contentFormat: row.content_format, author: row.author ?? undefined, digest: row.digest ?? undefined, summary: row.summary ?? undefined, outline: row.outline ?? [], topics: row.topics ?? [], keywords: row.keywords ?? [], coverUrl: row.cover_url ?? undefined, source: row.source ?? undefined, strategyId: row.strategy_id ?? undefined, seriesId: row.series_id ?? undefined, briefId: row.brief_id ?? undefined, status: row.status, similarity: Number(row.similarity), score: Number(row.score), risk: row.risk, warnings: row.warnings ?? [], matchedArticleId: row.matched_article_id ?? undefined, acceptedArticleId: row.accepted_article_id ?? undefined, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }

class PgCandidatePoolStore implements CandidatePoolStore {
  constructor(private readonly pool: Pool) {}
  private async ensure(date: string) { await this.pool.query("UPDATE candidate_pools SET status='closed',updated_at=now() WHERE pool_date < $1 AND status='open'", [date]); const result = await this.pool.query<CandidatePool>("INSERT INTO candidate_pools (id,pool_date,timezone) VALUES ($1,$2,$3) ON CONFLICT (pool_date) DO UPDATE SET updated_at=now() RETURNING id,pool_date AS \"poolDate\",timezone,status,version,last_evaluated_at AS \"lastEvaluatedAt\",created_at AS \"createdAt\",updated_at AS \"updatedAt\"", [randomUUID(), date, timezone]); return result.rows[0]; }
  private async listByPool(poolId: string) { const result = await this.pool.query<CandidateRow>("SELECT * FROM content_candidates WHERE pool_id=$1 ORDER BY score DESC, created_at ASC", [poolId]); return result.rows.map(toCandidate); }
  async getDaily() { const pool = await this.ensure(currentPoolDate()); return { pool, candidates: await this.listByPool(pool.id) }; }
  async submit(date: string, inputs: CandidateInput[]) { const pool = await this.ensure(date); const result: ContentCandidate[] = []; for (const input of inputs) { const inserted = await this.pool.query<CandidateRow>("INSERT INTO content_candidates (id,pool_id,external_id,title,content,content_format,author,digest,summary,outline,topics,keywords,cover_url,source,strategy_id,series_id,brief_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17) ON CONFLICT (pool_id,external_id) DO NOTHING RETURNING *", [randomUUID(),pool.id,input.externalId,input.title,input.content,input.contentFormat,input.author??null,input.digest??null,input.summary??null,JSON.stringify(input.outline??[]),JSON.stringify(input.topics??[]),JSON.stringify(input.keywords??[]),input.coverUrl??null,input.source??null,input.strategyId??null,input.seriesId??null,input.briefId??null]); if (inserted.rows[0]) result.push(toCandidate(inserted.rows[0])); else { const existing = await this.pool.query<CandidateRow>("SELECT * FROM content_candidates WHERE pool_id=$1 AND external_id=$2", [pool.id,input.externalId]); if (existing.rows[0]) result.push(toCandidate(existing.rows[0])); } } await this.recheck(date); const items = await this.listByPool(pool.id); return items.filter((item) => result.some((submitted) => submitted.id === item.id)); }
  async recheck(date = currentPoolDate()) { const pool = await this.ensure(date); const stored = await repository.listDedupCandidates(); const candidates = await this.listByPool(pool.id); const evaluated = applyRanking(candidates.map((candidate) => ({ ...candidate, ...evaluateCandidate(candidate, stored, candidates) }))); for (const candidate of evaluated) await this.pool.query("UPDATE content_candidates SET status=$2,similarity=$3,score=$4,risk=$5,warnings=$6::jsonb,matched_article_id=$7,updated_at=now() WHERE id=$1", [candidate.id,candidate.status,candidate.similarity,candidate.score,candidate.risk,JSON.stringify(candidate.warnings),candidate.matchedArticleId??null]); await this.pool.query("UPDATE candidate_pools SET version=version+1,last_evaluated_at=now(),updated_at=now() WHERE id=$1", [pool.id]); return evaluated.sort((left, right) => right.score - left.score); }
  async getCandidate(id: string) { const result = await this.pool.query<CandidateRow>("SELECT * FROM content_candidates WHERE id=$1", [id]); return result.rows[0] ? toCandidate(result.rows[0]) : undefined; }
  async accept(id: string, articleId: string) { const result = await this.pool.query<CandidateRow>("UPDATE content_candidates SET status='accepted',accepted_article_id=$2,updated_at=now() WHERE id=$1 RETURNING *", [id,articleId]); return result.rows[0] ? toCandidate(result.rows[0]) : undefined; }
}

const pool = config.DATABASE_URL ? new Pool({ connectionString: config.DATABASE_URL }) : undefined;
export const candidatePoolStore: CandidatePoolStore = pool ? new PgCandidatePoolStore(pool) : new MemoryCandidatePoolStore();
