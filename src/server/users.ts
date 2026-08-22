import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";
import { config } from "./config";

const scrypt = promisify(scryptCallback);
const USERNAME_PATTERN = /^[a-zA-Z0-9_\u4e00-\u9fff-]{3,64}$/;

export interface UserRecord { id: string; username: string; passwordHash: string; sessionVersion: number; }

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [salt, stored] = encoded.split(":");
  if (!salt || !stored) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(stored, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function validateNewUser(username: string, password: string) {
  if (!USERNAME_PATTERN.test(username)) throw new Error("用户名需为 3-64 位中文、字母、数字、下划线或短横线");
  if (password.length < 12) throw new Error("密码至少需要 12 位");
}

export interface UserStore {
  hasUsers(): Promise<boolean>;
  createFirstUser(username: string, password: string): Promise<UserRecord>;
  authenticate(username: string, password: string): Promise<UserRecord | undefined>;
  generateRecoveryCode(username: string): Promise<{ code: string; expiresAt: string }>;
  resetPassword(username: string, code: string, password: string): Promise<boolean>;
  getSessionVersion(username: string): Promise<number | undefined>;
}

function hashRecoveryCode(code: string) { return createHash("sha256").update(code).digest("hex"); }

export class MemoryUserStore implements UserStore {
  private user?: UserRecord;
  private recovery?: { username: string; codeHash: string; expiresAt: number };
  async hasUsers() { return Boolean(this.user); }
  async createFirstUser(username: string, password: string) {
    if (this.user) throw new Error("管理员账号已初始化");
    validateNewUser(username, password);
    this.user = { id: randomUUID(), username, passwordHash: await hashPassword(password), sessionVersion: 0 };
    return this.user;
  }
  async authenticate(username: string, password: string) {
    if (!this.user || this.user.username !== username || !(await verifyPassword(password, this.user.passwordHash))) return undefined;
    return this.user;
  }
  async generateRecoveryCode(username: string) {
    if (!this.user || this.user.username !== username) throw new Error("管理员账号不存在");
    const code = randomBytes(24).toString("base64url");
    const expiresAt = Date.now() + 15 * 60 * 1000;
    this.recovery = { username, codeHash: hashRecoveryCode(code), expiresAt };
    return { code, expiresAt: new Date(expiresAt).toISOString() };
  }
  async resetPassword(username: string, code: string, password: string) {
    validateNewUser(username, password);
    if (!this.user || this.user.username !== username || !this.recovery || this.recovery.username !== username || this.recovery.expiresAt <= Date.now() || this.recovery.codeHash !== hashRecoveryCode(code)) return false;
    this.user = { ...this.user, passwordHash: await hashPassword(password), sessionVersion: this.user.sessionVersion + 1 };
    this.recovery = undefined;
    return true;
  }
  async getSessionVersion(username: string) { return this.user?.username === username ? this.user.sessionVersion : undefined; }
}

class PgUserStore implements UserStore {
  constructor(private readonly pool: Pool) {}
  async hasUsers() { const result = await this.pool.query("SELECT 1 FROM users LIMIT 1"); return (result.rowCount ?? 0) > 0; }
  async createFirstUser(username: string, password: string) {
    validateNewUser(username, password);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(918273645)");
      const exists = await client.query("SELECT 1 FROM users LIMIT 1");
      if (exists.rowCount) throw new Error("管理员账号已初始化");
      const result = await client.query<{ id: string; username: string; password_hash: string; session_version: number }>("INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username, password_hash, session_version", [randomUUID(), username, await hashPassword(password)]);
      await client.query("COMMIT");
      return { id: result.rows[0].id, username: result.rows[0].username, passwordHash: result.rows[0].password_hash, sessionVersion: result.rows[0].session_version };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async authenticate(username: string, password: string) {
    const result = await this.pool.query<{ id: string; username: string; password_hash: string; session_version: number }>("SELECT id, username, password_hash, session_version FROM users WHERE username = $1", [username]);
    const row = result.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) return undefined;
    await this.pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [row.id]);
    return { id: row.id, username: row.username, passwordHash: row.password_hash, sessionVersion: row.session_version };
  }
  async generateRecoveryCode(username: string) {
    const user = await this.pool.query("SELECT 1 FROM users WHERE username = $1", [username]);
    if (!user.rowCount) throw new Error("管理员账号不存在");
    const code = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.pool.query("DELETE FROM admin_recovery_codes WHERE username = $1 AND used_at IS NULL", [username]);
    await this.pool.query("INSERT INTO admin_recovery_codes (id, username, code_hash, expires_at) VALUES ($1,$2,$3,$4)", [randomUUID(), username, hashRecoveryCode(code), expiresAt]);
    return { code, expiresAt: expiresAt.toISOString() };
  }
  async resetPassword(username: string, code: string, password: string) {
    validateNewUser(username, password);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const hash = await hashPassword(password);
      const updated = await client.query("UPDATE users SET password_hash = $3, session_version = session_version + 1 WHERE username = $1 AND EXISTS (SELECT 1 FROM admin_recovery_codes WHERE username = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > now()) RETURNING id", [username, hashRecoveryCode(code), hash]);
      if (!updated.rowCount) { await client.query("ROLLBACK"); return false; }
      await client.query("UPDATE admin_recovery_codes SET used_at = now() WHERE username = $1 AND code_hash = $2 AND used_at IS NULL", [username, hashRecoveryCode(code)]);
      await client.query("COMMIT");
      return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async getSessionVersion(username: string) { const result = await this.pool.query<{ session_version: number }>("SELECT session_version FROM users WHERE username = $1", [username]); return result.rows[0]?.session_version; }
}

const pool = config.DATABASE_URL ? new Pool({ connectionString: config.DATABASE_URL }) : undefined;
export const userStore: UserStore = pool ? new PgUserStore(pool) : new MemoryUserStore();
export const userStoreReady = pool ? pool.query("SELECT 1").then(() => undefined) : Promise.resolve();
