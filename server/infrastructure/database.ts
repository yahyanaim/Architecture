/**
 * SQLite connection (better-sqlite3).
 *
 * ARCHITECTURE: infrastructure adapter detail — nothing outside
 * `server/infrastructure` may import this. Domain code depends on repository
 * PORTS (`server/domain/interfaces`); routes/services receive repositories,
 * never this handle. To move to Postgres/Neon: implement the same ports
 * against `@neondatabase/serverless` (see `PostgresUserRepository` stub),
 * point `SharedUserRepository` at it, and reuse `db/migrations` (standard
 * SQL, TEXT timestamps — no SQLite-only functions).
 *
 * STORAGE LIFECYCLE: `DB_PATH` (or `data/app.db`); WAL mode so readers never
 * block writers; foreign keys enforced. `NODE_ENV=test` uses an isolated
 * in-memory DB so tests never touch dev data.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

function resolvePath(): string {
  if (process.env.NODE_ENV === 'test') return ':memory:';
  if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);
  return path.resolve(process.cwd(), 'data', 'app.db');
}

const dbPath = resolvePath();
if (dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export const db = new Database(dbPath);

if (dbPath !== ':memory:') {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

export const DB_PATH = dbPath;
