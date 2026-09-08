-- 001_init: SaaS foundation schema.
-- Written in portable SQL (TEXT PKs, ISO-8601 TEXT timestamps, no
-- SQLite-only functions) so the same migrations run on Postgres later.
-- Idempotent: every statement is IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- Tenancy root. Every user belongs to exactly one organization (their
-- workspace). Shared-schema multi-tenancy: rows are scoped by org_id in
-- repository queries, never trusted from client input.
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

-- Identity is global (email UNIQUE across orgs) so login needs no tenant
-- hint; data access is org-scoped. email_verified_at NULL = unverified.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  role TEXT NOT NULL DEFAULT 'user',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT NULL,
  email_verified_at TEXT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);

-- Opaque refresh sessions. Only SHA-256 hashes are stored (never the token).
-- Rotation: each use revokes the old row and links the replacement; reuse of
-- a revoked row signals theft -> whole chain revoked (see AuthService).
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NULL,
  replaced_by TEXT NULL,
  created_at TEXT NOT NULL,
  ip TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- Single-use tokens: email verification, password reset, org invites.
-- Payload-light: invite context (org/role) lives in `meta` JSON.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT NULL,
  created_at TEXT NOT NULL,
  meta TEXT NULL
);

-- Billing seam: one row per org from birth (free/trialing). Real providers
-- (Stripe) only ever UPDATE this row via webhooks — plans are enforced by
-- `requirePlan` middleware reading it, so billing stays out of controllers.
CREATE TABLE IF NOT EXISTS subscriptions (
  org_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'trialing',
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_ref TEXT NULL,
  current_period_end TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Durable job queue (see JobQueue). Worker leases due rows; failures back
-- off exponentially; exhausted rows park in 'dead' for inspection/replay.
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  run_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(status, run_at);
