import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { config } from "./config";

export type TokenKind = "api" | "ai_read" | "ai_write";
export interface TokenInfo { id: string; name: string; kind: TokenKind; prefix: string; createdAt: string; revokedAt?: string; }
export interface CreatedToken { info: TokenInfo; secret: string; }

const hash = (secret: string) => createHash("sha256").update(secret).digest("hex");
const now = () => new Date().toISOString();

export interface TokenStore { list(): Promise<TokenInfo[]>; create(name: string, kind: TokenKind): Promise<CreatedToken>; revoke(id: string): Promise<boolean>; verify(kind: TokenKind, secret: string): Promise<boolean>; }

export class MemoryTokenStore implements TokenStore {
  private tokens = new Map<string, { info: TokenInfo; hash: string }>();
  async list() { return [...this.tokens.values()].map((item) => item.info).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async create(name: string, kind: TokenKind) { const secret = randomBytes(32).toString("base64url"); const info: TokenInfo = { id: randomUUID(), name, kind, prefix: secret.slice(0, 8), createdAt: now() }; this.tokens.set(info.id, { info, hash: hash(secret) }); return { info, secret }; }
  async revoke(id: string) { const item = this.tokens.get(id); if (!item || item.info.revokedAt) return false; item.info.revokedAt = now(); return true; }
  async verify(kind: TokenKind, secret: string) { const value = hash(secret); return [...this.tokens.values()].some((item) => item.info.kind === kind && !item.info.revokedAt && item.hash === value); }
}

class PgTokenStore implements TokenStore {
  constructor(private readonly pool: Pool) {}
  async list() { const result = await this.pool.query<TokenInfo>("SELECT id,name,kind,token_prefix AS \"prefix\",created_at AS \"createdAt\",revoked_at AS \"revokedAt\" FROM api_tokens ORDER BY created_at DESC"); return result.rows; }
  async create(name: string, kind: TokenKind) { const secret = randomBytes(32).toString("base64url"); const info: TokenInfo = { id: randomUUID(), name, kind, prefix: secret.slice(0, 8), createdAt: now() }; const result = await this.pool.query<TokenInfo>("INSERT INTO api_tokens (id,name,kind,token_hash,token_prefix) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,kind,token_prefix AS \"prefix\",created_at AS \"createdAt\",revoked_at AS \"revokedAt\"", [info.id,name,kind,hash(secret),info.prefix]); return { info: result.rows[0], secret }; }
  async revoke(id: string) { const result = await this.pool.query("UPDATE api_tokens SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL", [id]); return result.rowCount === 1; }
  async verify(kind: TokenKind, secret: string) { const result = await this.pool.query("SELECT 1 FROM api_tokens WHERE kind=$1 AND token_hash=$2 AND revoked_at IS NULL LIMIT 1", [kind,hash(secret)]); return result.rowCount === 1; }
}

const pool = config.DATABASE_URL ? new Pool({ connectionString: config.DATABASE_URL }) : undefined;
export const tokenStore: TokenStore = pool ? new PgTokenStore(pool) : new MemoryTokenStore();
export const tokenStoreReady = pool ? pool.query("SELECT 1").then(() => undefined) : Promise.resolve();
