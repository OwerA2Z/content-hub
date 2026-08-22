import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { config } from "../config";

if (!config.DATABASE_URL) {
  console.error("DATABASE_URL is required for migrations");
  process.exit(1);
}

const pool = new Pool({ connectionString: config.DATABASE_URL });
const migrations = ["0001_init", "0002_users", "0003_recovery_codes", "0004_session_version"];

try {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(100) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const version of migrations) {
    const existing = await pool.query("SELECT version FROM schema_migrations WHERE version = $1", [version]);
    if (existing.rowCount !== 0) { console.log(`Migration ${version} already applied`); continue; }
    const sql = await readFile(resolve(process.cwd(), `migrations/${version}.sql`), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations(version) VALUES ($1)", [version]);
      await pool.query("COMMIT");
      console.log(`Applied migration ${version}`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await pool.end();
}
