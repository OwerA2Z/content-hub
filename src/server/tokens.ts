import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { config } from "./config";
import { TOKEN_SCOPES, type TokenScope } from "../shared/scopes";

export { TOKEN_SCOPES } from "../shared/scopes";
export type { TokenScope } from "../shared/scopes";

export interface TokenInfo { id: string; name: string; scopes: TokenScope[]; prefix: string; createdAt: string; revokedAt?: string; }
export interface CreatedToken { info: TokenInfo; secret: string; }

const hash = (secret: string) => createHash("sha256").update(secret).digest("hex");
const now = () => new Date().toISOString();

export function normalizeScopes(scopes: readonly string[]) {
  const known = new Set<string>(TOKEN_SCOPES);
  const normalized = scopes.map((scope) => scope.trim());
  const unknown = normalized.filter((scope) => !known.has(scope));
  if (unknown.length) throw new Error(`Token 包含未知权限：${[...new Set(unknown)].join(", ")}`);
  const unique = [...new Set(normalized)];
  if (!unique.length) throw new Error("Token 至少需要一个有效权限");
  return unique as TokenScope[];
}

export interface TokenStore { list(): Promise<TokenInfo[]>; create(name: string, scopes: readonly TokenScope[]): Promise<CreatedToken>; revoke(id: string): Promise<boolean>; verify(secret: string, requiredScopes: readonly TokenScope[]): Promise<boolean>; }

export class MemoryTokenStore implements TokenStore {
  private tokens = new Map<string, { info: TokenInfo; hash: string }>();
  async list() { return [...this.tokens.values()].map((item) => item.info).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async create(name: string, scopes: readonly TokenScope[]) { const secret = randomBytes(32).toString("base64url"); const info: TokenInfo = { id: randomUUID(), name, scopes: normalizeScopes(scopes), prefix: secret.slice(0, 8), createdAt: now() }; this.tokens.set(info.id, { info, hash: hash(secret) }); return { info, secret }; }
  async revoke(id: string) { const item = this.tokens.get(id); if (!item || item.info.revokedAt) return false; item.info.revokedAt = now(); return true; }
  async verify(secret: string, requiredScopes: readonly TokenScope[]) { const value = hash(secret); return [...this.tokens.values()].some((item) => !item.info.revokedAt && item.hash === value && requiredScopes.every((scope) => item.info.scopes.includes(scope))); }
}

class PgTokenStore implements TokenStore {
  constructor(private readonly pool: Pool) {}
  async list() { const result = await this.pool.query<TokenInfo>("SELECT id,name,scopes,token_prefix AS \"prefix\",created_at AS \"createdAt\",revoked_at AS \"revokedAt\" FROM api_tokens ORDER BY created_at DESC"); return result.rows.map((row) => ({ ...row, scopes: normalizeScopes(row.scopes) })); }
  async create(name: string, scopes: readonly TokenScope[]) { const secret = randomBytes(32).toString("base64url"); const info: TokenInfo = { id: randomUUID(), name, scopes: normalizeScopes(scopes), prefix: secret.slice(0, 8), createdAt: now() }; const result = await this.pool.query<TokenInfo>("INSERT INTO api_tokens (id,name,scopes,token_hash,token_prefix) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING id,name,scopes,token_prefix AS \"prefix\",created_at AS \"createdAt\",revoked_at AS \"revokedAt\"", [info.id,name,JSON.stringify(info.scopes),hash(secret),info.prefix]); return { info: { ...result.rows[0], scopes: normalizeScopes(result.rows[0].scopes) }, secret }; }
  async revoke(id: string) { const result = await this.pool.query("UPDATE api_tokens SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL", [id]); return result.rowCount === 1; }
  async verify(secret: string, requiredScopes: readonly TokenScope[]) { const result = await this.pool.query<{ allowed: boolean }>("SELECT scopes @> $2::jsonb AS allowed FROM api_tokens WHERE token_hash=$1 AND revoked_at IS NULL LIMIT 1", [hash(secret), JSON.stringify(requiredScopes)]); return result.rows[0]?.allowed === true; }
}

const pool = config.DATABASE_URL ? new Pool({ connectionString: config.DATABASE_URL }) : undefined;
export const tokenStore: TokenStore = pool ? new PgTokenStore(pool) : new MemoryTokenStore();
export const tokenStoreReady = pool ? pool.query("SELECT 1").then(() => undefined) : Promise.resolve();
