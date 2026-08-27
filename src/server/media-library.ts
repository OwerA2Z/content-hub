import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import { config } from "./config";
import { mediaAssetStatusSchema, type MediaAsset, type MediaAssetListQuery, type MediaAssetStatus, type MediaMimeType } from "../shared/media";

export interface CreateMediaAssetInput {
  originalName: string;
  storageKey: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
  width?: number;
  height?: number;
  alt?: string;
  tags?: string[];
}

export interface UpdateMediaAssetInput {
  alt?: string;
  tags?: string[];
  status?: MediaAssetStatus;
}

export interface MediaAssetRepository {
  list(query: MediaAssetListQuery): Promise<{ items: MediaAsset[]; total: number }>;
  get(id: string): Promise<MediaAsset | undefined>;
  create(input: CreateMediaAssetInput): Promise<MediaAsset>;
  update(id: string, input: UpdateMediaAssetInput): Promise<MediaAsset | undefined>;
  archive(id: string): Promise<MediaAsset | undefined>;
}

const now = () => new Date().toISOString();

function normalizeTags(tags: string[] | undefined) {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 30);
}

export class MemoryMediaAssetRepository implements MediaAssetRepository {
  private readonly assets = new Map<string, MediaAsset>();

  async list(query: MediaAssetListQuery) {
    const q = query.q?.toLowerCase();
    const filtered = [...this.assets.values()]
      .filter((asset) => !query.status ? asset.status === "active" : asset.status === query.status)
      .filter((asset) => !q || `${asset.originalName} ${asset.alt ?? ""} ${asset.tags.join(" ")}`.toLowerCase().includes(q))
      .filter((asset) => !query.tag || asset.tags.includes(query.tag))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const start = (query.page - 1) * query.pageSize;
    return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
  }

  async get(id: string) { return this.assets.get(id); }

  async create(input: CreateMediaAssetInput) {
    const timestamp = now();
    const asset: MediaAsset = {
      id: randomUUID(), kind: "image", originalName: input.originalName, storageKey: input.storageKey,
      mimeType: input.mimeType, sizeBytes: input.sizeBytes, width: input.width, height: input.height,
      alt: input.alt, tags: normalizeTags(input.tags), status: "active", createdAt: timestamp, updatedAt: timestamp,
    };
    this.assets.set(asset.id, asset);
    return asset;
  }

  async update(id: string, input: UpdateMediaAssetInput) {
    const asset = this.assets.get(id);
    if (!asset) return undefined;
    const updated = { ...asset, ...(input.alt !== undefined ? { alt: input.alt } : {}), ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}), ...(input.status !== undefined ? { status: input.status } : {}), updatedAt: now() };
    this.assets.set(id, updated);
    return updated;
  }

  async archive(id: string) { return this.update(id, { status: "archived" }); }
}

type MediaAssetRow = QueryResultRow & {
  id: string; kind: "image"; original_name: string; storage_key: string; mime_type: MediaMimeType; size_bytes: string | number;
  width: number | null; height: number | null; alt: string | null; tags: string[]; status: MediaAssetStatus; created_at: Date; updated_at: Date;
};

function toMediaAsset(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id, kind: row.kind, originalName: row.original_name, storageKey: row.storage_key, mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes), width: row.width ?? undefined, height: row.height ?? undefined,
    alt: row.alt ?? undefined, tags: row.tags ?? [], status: mediaAssetStatusSchema.parse(row.status),
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  };
}

export class PgMediaAssetRepository implements MediaAssetRepository {
  constructor(private readonly pool: Pool) {}

  async list(query: MediaAssetListQuery) {
    const values: unknown[] = [];
    const clauses = [query.status ? "status = $1" : "status = 'active'"];
    if (query.status) values.push(query.status);
    if (query.q) { values.push(`%${query.q}%`); clauses.push(`(original_name ILIKE $${values.length} OR alt ILIKE $${values.length} OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) tag WHERE tag ILIKE $${values.length}))`); }
    if (query.tag) { values.push(JSON.stringify([query.tag])); clauses.push(`tags @> $${values.length}::jsonb`); }
    const where = clauses.join(" AND ");
    const count = await this.pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM media_assets WHERE ${where}`, values);
    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const rows = await this.pool.query<MediaAssetRow>(`SELECT * FROM media_assets WHERE ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    return { items: rows.rows.map(toMediaAsset), total: Number(count.rows[0]?.count ?? 0) };
  }

  async get(id: string) { const result = await this.pool.query<MediaAssetRow>("SELECT * FROM media_assets WHERE id = $1", [id]); return result.rows[0] ? toMediaAsset(result.rows[0]) : undefined; }

  async create(input: CreateMediaAssetInput) {
    const result = await this.pool.query<MediaAssetRow>(
      `INSERT INTO media_assets (id, kind, original_name, storage_key, mime_type, size_bytes, width, height, alt, tags)
       VALUES ($1,'image',$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
      [randomUUID(), input.originalName, input.storageKey, input.mimeType, input.sizeBytes, input.width ?? null, input.height ?? null, input.alt ?? null, JSON.stringify(normalizeTags(input.tags))],
    );
    if (!result.rows[0]) throw new Error("素材保存后无法读取记录");
    return toMediaAsset(result.rows[0]);
  }

  async update(id: string, input: UpdateMediaAssetInput) {
    const result = await this.pool.query<MediaAssetRow>(
      `UPDATE media_assets SET alt = COALESCE($2, alt), tags = COALESCE($3::jsonb, tags), status = COALESCE($4, status), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, input.alt ?? null, input.tags === undefined ? null : JSON.stringify(normalizeTags(input.tags)), input.status ?? null],
    );
    return result.rows[0] ? toMediaAsset(result.rows[0]) : undefined;
  }

  async archive(id: string) { return this.update(id, { status: "archived" }); }
}

const pool = config.DATABASE_URL ? new Pool({ connectionString: config.DATABASE_URL }) : undefined;
export const mediaAssetRepository: MediaAssetRepository = pool ? new PgMediaAssetRepository(pool) : new MemoryMediaAssetRepository();
export const mediaRepositoryReady = pool ? pool.query("SELECT 1").then(() => undefined) : Promise.resolve();
