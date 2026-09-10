/**
 * Migration runner + one-time legacy import.
 *
 * LIFECYCLE: `migrate()` runs at boot (`server.ts`) BEFORE `app.listen` and
 * before the job worker starts, so the schema always precedes traffic. It is
 * idempotent (`schema_migrations` ledger) — safe to run on every boot and in
 * every environment. New schema change = new `NNN_name.sql` file, never edit
 * an applied migration.
 *
 * LEGACY IMPORT: if the users table is empty and a legacy `data/users.json`
 * exists (the pre-SQLite store), rows are imported once into the `default`
 * org with `email_verified_at` set (grandfathered — they predate
 * verification). The file is then renamed to `users.json.migrated` so the
 * import never runs twice.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from '../database';

// ESM-safe dir resolution (`__dirname` doesn't exist in ESM scope — the
// project is `"type": "module"` and runs under tsx as ESM).
// `MIGRATIONS_DIR` override exists for packaged deploys (Docker): the bundle
// flattens source files, so SQL ships separately (see Dockerfile) and the
// path is injected at runtime instead of derived from this file's location.
const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

function now(): string {
  return new Date().toISOString();
}

function uid(): string {
  return crypto.randomUUID();
}

export function migrate(target: typeof db = db): void {
  target.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, applied_at TEXT NOT NULL
  )`);

  const applied = new Set(
    target.prepare('SELECT version FROM schema_migrations').all().map((r: any) => r.version as string)
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = path.basename(file, '.sql');
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const txn = target.transaction(() => {
      target.exec(sql);
      target.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    });
    txn();
    // eslint-disable-next-line no-console
    console.log(`[migrate] applied ${version}`);
  }

  // Backfill memberships for any existing users
  const hasMemberships = target.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memberships'").get();
  if (hasMemberships) {
    const unlinked = target.prepare(`
      SELECT u.id, u.org_id, u.role, u.created_at
      FROM users u
      LEFT JOIN memberships m ON u.id = m.user_id AND u.org_id = m.org_id
      WHERE m.id IS NULL
    `).all() as any[];

    if (unlinked.length > 0) {
      const insertMem = target.prepare(`
        INSERT INTO memberships (id, user_id, org_id, role, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const txn = target.transaction(() => {
        for (const u of unlinked) {
          insertMem.run(uid(), u.id, u.org_id, u.role || 'user', u.created_at || now());
        }
      });
      txn();
    }
  }

  importLegacyUsers(target);
}

function ensureDefaultOrg(target: typeof db): string {
  const existing = target.prepare('SELECT id FROM organizations WHERE slug = ?').get('default') as any;
  if (existing) return existing.id as string;
  const id = uid();
  target
    .prepare(
      'INSERT INTO organizations (id, name, slug, plan, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, 'Default workspace', 'default', 'free', 'active', now());
  target
    .prepare(
      `INSERT INTO subscriptions (org_id, plan, status, provider, provider_ref, current_period_end, created_at, updated_at)
       VALUES (?, 'free', 'active', 'manual', NULL, NULL, ?, ?)`
    )
    .run(id, now(), now());
  return id;
}

function importLegacyUsers(target: typeof db): void {
  const count = (target.prepare('SELECT COUNT(*) AS n FROM users').get() as any).n as number;
  if (count > 0) return;

  const legacyPath = path.join(process.cwd(), 'data', 'users.json');
  if (!fs.existsSync(legacyPath)) return;

  try {
    const raw = JSON.parse(fs.readFileSync(legacyPath, 'utf-8')) as any[];
    if (!Array.isArray(raw) || raw.length === 0) return;
    const orgId = ensureDefaultOrg(target);

    const insert = target.prepare(
      `INSERT OR IGNORE INTO users
       (id, name, email, password, org_id, created_at, is_active, role, failed_attempts, locked_until, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const txn = target.transaction(() => {
      for (const u of raw) {
        insert.run(
          u.id ?? uid(),
          u.name ?? 'Imported user',
          String(u.email ?? '').toLowerCase(),
          u.password ?? '',
          orgId,
          u.createdAt ?? now(),
          u.isActive === false ? 0 : 1,
          u.role === 'admin' ? 'admin' : 'user',
          u.failedLoginAttempts ?? 0,
          u.lockedUntil ?? null,
          now() // grandfathered: accounts predate verification
        );
      }
    });
    txn();
    fs.renameSync(legacyPath, legacyPath + '.migrated');
    // eslint-disable-next-line no-console
    console.log(`[migrate] imported ${raw.length} legacy user(s) into org "default"`);
  } catch (err) {
    // Never fail boot on a best-effort import; operator can retry manually.
    // eslint-disable-next-line no-console
    console.error('[migrate] legacy import skipped:', (err as Error).message);
  }
}
