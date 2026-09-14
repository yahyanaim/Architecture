/**
 * PostgreSQL migration runner.
 *
 * LIFECYCLE: `migratePg()` runs at boot (`server.ts`) when `DATABASE_URL` is set,
 * BEFORE `app.listen`. It is idempotent (tracked in `schema_migrations`).
 *
 * COMPATIBILITY: Reads portable migrations in `migrations/` (001..007),
 * transparently mapping SQLite dialect differences (such as `AUTOINCREMENT`
 * to `SERIAL PRIMARY KEY`) so that the exact same migration files serve both
 * SQLite (dev/test) and PostgreSQL (production).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { getPgPool } from '../pg';

const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

function now(): string {
  return new Date().toISOString();
}

function uid(): string {
  return crypto.randomUUID();
}

/**
 * Normalizes portable SQLite/Postgres SQL statements for execution on PostgreSQL.
 */
export function normalizeSqlForPostgres(sql: string): string {
  return sql
    .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
}

export async function migratePg(poolInstance?: pg.Pool): Promise<void> {
  const pool = poolInstance ?? getPgPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    const appliedRes = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations'
    );
    const applied = new Set(appliedRes.rows.map((r) => r.version));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = path.basename(file, '.sql');
      if (applied.has(version)) continue;

      const rawSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const sql = normalizeSqlForPostgres(rawSql);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)',
          [version, now()]
        );
        await client.query('COMMIT');
        // eslint-disable-next-line no-console
        console.log(`[migrate-pg] applied ${version}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    // Ensure default organization exists
    await ensureDefaultOrgPg(client);

    // Backfill memberships if table exists
    await backfillMembershipsPg(client);
  } finally {
    client.release();
  }
}

async function ensureDefaultOrgPg(client: pg.PoolClient): Promise<string> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1',
    ['default']
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const id = uid();
  const timestamp = now();
  await client.query(
    'INSERT INTO organizations (id, name, slug, plan, status, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO NOTHING',
    [id, 'Default workspace', 'default', 'free', 'active', timestamp]
  );
  await client.query(
    `INSERT INTO subscriptions (org_id, plan, status, provider, provider_ref, current_period_end, created_at, updated_at)
     VALUES ($1, 'free', 'active', 'manual', NULL, NULL, $2, $3)
     ON CONFLICT(org_id) DO NOTHING`,
    [id, timestamp, timestamp]
  );
  return id;
}

async function backfillMembershipsPg(client: pg.PoolClient): Promise<void> {
  const hasTable = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'memberships'
     )`
  );

  if (hasTable.rows[0]?.exists) {
    const unlinked = await client.query<{ id: string; org_id: string; role: string; created_at: string }>(
      `SELECT u.id, u.org_id, u.role, u.created_at
       FROM users u
       LEFT JOIN memberships m ON u.id = m.user_id AND u.org_id = m.org_id
       WHERE m.id IS NULL`
    );

    for (const u of unlinked.rows) {
      await client.query(
        `INSERT INTO memberships (id, user_id, org_id, role, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(user_id, org_id) DO NOTHING`,
        [uid(), u.id, u.org_id, u.role || 'user', u.created_at || now()]
      );
    }
  }
}
