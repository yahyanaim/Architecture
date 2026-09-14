-- 014_billing_usage: Seat count on subscriptions and usage_events table for metered billing.
-- Portable SQL for SQLite and PostgreSQL (via normalizeSqlForPostgres).

-- Add seat count column to subscriptions with default of 5 seats
ALTER TABLE subscriptions ADD COLUMN seats INTEGER NOT NULL DEFAULT 5;

-- Metered usage events table scoped by org_id
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_org ON usage_events(org_id, event_name, timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_idempotency ON usage_events(org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
