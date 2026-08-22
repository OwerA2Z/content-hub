import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import type { Article, ArticleStatus, Operation, UploadArticleInput } from "../../shared/contracts";
import { config } from "../config";

export interface ArticleQuery {
  q?: string;
  status?: ArticleStatus;
  page: number;
  pageSize: number;
  includeArchived?: boolean;
}

export interface AuditEntry {
  action: string;
  actorType: "api" | "admin" | "system";
  actorId?: string;
  articleId?: string;
  operationId?: string;
  success?: boolean;
}

export interface ArticleRepository {
  createOrGet(input: UploadArticleInput): Promise<{ article: Article; created: boolean }>;
  list(query: ArticleQuery): Promise<{ items: Article[]; total: number }>;
  get(id: string): Promise<Article | undefined>;
  updateStatus(id: string, status: ArticleStatus): Promise<Article | undefined>;
  createOperation(articleId: string, action: Operation["action"]): Promise<Operation>;
  getOperation(id: string): Promise<Operation | undefined>;
  getLatestFailedOperation(articleId: string): Promise<Operation | undefined>;
  listPendingOperations(): Promise<Operation[]>;
  completeOperation(id: string, status: Operation["status"], values?: Pick<Operation, "externalId" | "errorMessage">): Promise<Operation | undefined>;
  recordAudit(entry: AuditEntry): Promise<void>;
}

export class MemoryRepository implements ArticleRepository {
  private readonly articles = new Map<string, Article>();
  private readonly operations = new Map<string, Operation>();

  async createOrGet(input: UploadArticleInput): Promise<{ article: Article; created: boolean }> {
    const existing = [...this.articles.values()].find(
      (article) => article.source === input.source && article.externalId === input.externalId && input.source && input.externalId,
    );
    if (existing) return { article: existing, created: false };
    const now = new Date().toISOString();
    const article: Article = {
      id: randomUUID(),
      ...input,
      images: input.images ?? [],
      metadata: input.metadata ?? {},
      status: "uploaded",
      createdAt: now,
      updatedAt: now,
    };
    this.articles.set(article.id, article);
    return { article, created: true };
  }

  async list(query: ArticleQuery): Promise<{ items: Article[]; total: number }> {
    const filtered = [...this.articles.values()]
      .filter((article) => query.includeArchived || article.status !== "archived")
      .filter((article) => !query.status || article.status === query.status)
      .filter((article) => !query.q || `${article.title} ${article.digest ?? ""}`.toLowerCase().includes(query.q.toLowerCase()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (query.page - 1) * query.pageSize;
    return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
  }

  async get(id: string): Promise<Article | undefined> {
    return this.articles.get(id);
  }

  async updateStatus(id: string, status: ArticleStatus): Promise<Article | undefined> {
    const article = this.articles.get(id);
    if (!article) return undefined;
    const updated = { ...article, status, updatedAt: new Date().toISOString(), ...(status === "archived" ? { archivedAt: new Date().toISOString() } : {}) };
    this.articles.set(id, updated);
    return updated;
  }

  async createOperation(articleId: string, action: Operation["action"]): Promise<Operation> {
    const existing = [...this.operations.values()].find((item) => item.articleId === articleId && item.action === action && item.status === "pending");
    if (existing) return existing;
    const operation: Operation = { id: randomUUID(), articleId, provider: "wechat", action, status: "pending", createdAt: new Date().toISOString() };
    this.operations.set(operation.id, operation);
    return operation;
  }

  async getOperation(id: string): Promise<Operation | undefined> { return this.operations.get(id); }
  async getLatestFailedOperation(articleId: string) { return [...this.operations.values()].filter((item) => item.articleId === articleId && item.status === "failed").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; }
  async listPendingOperations() { return [...this.operations.values()].filter((item) => item.status === "pending"); }

  async completeOperation(id: string, status: Operation["status"], values?: Pick<Operation, "externalId" | "errorMessage">): Promise<Operation | undefined> {
    const operation = this.operations.get(id);
    if (!operation) return undefined;
    const updated = { ...operation, status, ...values, completedAt: new Date().toISOString() };
    this.operations.set(id, updated);
    return updated;
  }

  async recordAudit(_entry: AuditEntry) { /* 内存适配器不持久化审计，仅保证接口一致。 */ }
}

type ArticleRow = QueryResultRow & {
  id: string; external_id: string | null; source: string | null; title: string; content: string;
  content_format: "html"; author: string | null; digest: string | null; cover_url: string | null;
  images: string[]; metadata: Record<string, unknown>; status: ArticleStatus; created_at: Date; updated_at: Date; archived_at: Date | null;
};

function toArticle(row: ArticleRow): Article {
  return {
    id: row.id, externalId: row.external_id ?? undefined, source: row.source ?? undefined, title: row.title,
    content: row.content, contentFormat: row.content_format, author: row.author ?? undefined, digest: row.digest ?? undefined,
    coverUrl: row.cover_url ?? undefined, images: row.images ?? [], metadata: row.metadata ?? {}, status: row.status,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), archivedAt: row.archived_at?.toISOString(),
  };
}

/** PostgreSQL 适配器：配置 DATABASE_URL 后自动启用，开发无数据库时仍可用内存适配器。 */
export class PgRepository implements ArticleRepository {
  private readonly pool: Pool;
  private readonly ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.ready = this.pool.query("SELECT 1").then(() => undefined);
  }

  async waitUntilReady() { await this.ready; }

  async createOrGet(input: UploadArticleInput): Promise<{ article: Article; created: boolean }> {
    await this.ready;
    const id = randomUUID();
    const result = await this.pool.query<ArticleRow>(
      `INSERT INTO articles (id, external_id, source, title, content, content_format, author, digest, cover_url, images, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)
       ON CONFLICT (source, external_id) WHERE source IS NOT NULL AND external_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [id, input.externalId ?? null, input.source ?? null, input.title, input.content, input.contentFormat, input.author ?? null, input.digest ?? null, input.coverUrl ?? null, JSON.stringify(input.images ?? []), JSON.stringify(input.metadata ?? {})],
    );
    if (result.rows[0]) return { article: toArticle(result.rows[0]), created: true };
    const existing = await this.pool.query<ArticleRow>("SELECT * FROM articles WHERE source = $1 AND external_id = $2 LIMIT 1", [input.source, input.externalId]);
    if (!existing.rows[0]) throw new Error("幂等文章写入后无法读取记录");
    return { article: toArticle(existing.rows[0]), created: false };
  }

  async list(query: ArticleQuery): Promise<{ items: Article[]; total: number }> {
    await this.ready;
    const values: unknown[] = [];
    const clauses = [query.includeArchived ? "TRUE" : "status <> 'archived'"];
    if (query.status) { values.push(query.status); clauses.push(`status = $${values.length}`); }
    if (query.q) { values.push(`%${query.q}%`); clauses.push(`(title ILIKE $${values.length} OR digest ILIKE $${values.length})`); }
    const where = clauses.join(" AND ");
    const count = await this.pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM articles WHERE ${where}`, values);
    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const rows = await this.pool.query<ArticleRow>(`SELECT * FROM articles WHERE ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    return { items: rows.rows.map(toArticle), total: Number(count.rows[0]?.count ?? 0) };
  }

  async get(id: string) { await this.ready; const result = await this.pool.query<ArticleRow>("SELECT * FROM articles WHERE id = $1", [id]); return result.rows[0] ? toArticle(result.rows[0]) : undefined; }
  async updateStatus(id: string, status: ArticleStatus) { await this.ready; const result = await this.pool.query<ArticleRow>("UPDATE articles SET status = $2, updated_at = now(), archived_at = CASE WHEN $2 = 'archived' THEN now() ELSE NULL END WHERE id = $1 RETURNING *", [id, status]); return result.rows[0] ? toArticle(result.rows[0]) : undefined; }
  async createOperation(articleId: string, action: Operation["action"]) { await this.ready; const operation: Operation = { id: randomUUID(), articleId, provider: "wechat", action, status: "pending", createdAt: new Date().toISOString() }; const inserted = await this.pool.query<Operation>("INSERT INTO channel_operations (id, article_id, provider, action) VALUES ($1,$2,$3,$4) ON CONFLICT (article_id, provider, action) WHERE status = 'pending' DO NOTHING RETURNING id, article_id AS \"articleId\", provider, action, status, external_id AS \"externalId\", error_message AS \"errorMessage\", created_at AS \"createdAt\", completed_at AS \"completedAt\"", [operation.id, articleId, "wechat", action]); if (inserted.rows[0]) return inserted.rows[0]; const existing = await this.pool.query<Operation>("SELECT id, article_id AS \"articleId\", provider, action, status, external_id AS \"externalId\", error_message AS \"errorMessage\", created_at AS \"createdAt\", completed_at AS \"completedAt\" FROM channel_operations WHERE article_id = $1 AND action = $2 AND status = 'pending' LIMIT 1", [articleId, action]); if (!existing.rows[0]) throw new Error("渠道操作幂等写入后无法读取任务"); return existing.rows[0]; }
  async getOperation(id: string) { await this.ready; const result = await this.pool.query<Operation>("SELECT id, article_id AS \"articleId\", provider, action, status, external_id AS \"externalId\", error_message AS \"errorMessage\", created_at AS \"createdAt\", completed_at AS \"completedAt\" FROM channel_operations WHERE id = $1", [id]); return result.rows[0]; }
  async getLatestFailedOperation(articleId: string) { await this.ready; const result = await this.pool.query<Operation>("SELECT id, article_id AS \"articleId\", provider, action, status, external_id AS \"externalId\", error_message AS \"errorMessage\", created_at AS \"createdAt\", completed_at AS \"completedAt\" FROM channel_operations WHERE article_id = $1 AND status = 'failed' ORDER BY created_at DESC LIMIT 1", [articleId]); return result.rows[0]; }
  async listPendingOperations() { await this.ready; const result = await this.pool.query<Operation>("SELECT id, article_id AS \"articleId\", provider, action, status, external_id AS \"externalId\", error_message AS \"errorMessage\", created_at AS \"createdAt\", completed_at AS \"completedAt\" FROM channel_operations WHERE status = 'pending' ORDER BY created_at ASC"); return result.rows; }
  async completeOperation(id: string, status: Operation["status"], values?: Pick<Operation, "externalId" | "errorMessage">) { await this.ready; const result = await this.pool.query<Operation>("UPDATE channel_operations SET status = $2, external_id = $3, error_message = $4, completed_at = now() WHERE id = $1 RETURNING id, article_id AS \"articleId\", provider, action, status, external_id AS \"externalId\", error_message AS \"errorMessage\", created_at AS \"createdAt\", completed_at AS \"completedAt\"", [id, status, values?.externalId ?? null, values?.errorMessage ?? null]); return result.rows[0]; }
  async recordAudit(entry: AuditEntry) { await this.ready; await this.pool.query("INSERT INTO audit_logs (id, action, actor_type, actor_id, article_id, operation_id, success) VALUES ($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), entry.action, entry.actorType, entry.actorId ?? null, entry.articleId ?? null, entry.operationId ?? null, entry.success ?? true]); }
}

export const repository: ArticleRepository = config.DATABASE_URL ? new PgRepository(config.DATABASE_URL) : new MemoryRepository();
export const repositoryKind = config.DATABASE_URL ? "postgresql" : "memory-development";
export const repositoryReady = repository instanceof PgRepository ? repository.waitUntilReady() : Promise.resolve();
