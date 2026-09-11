-- 004_outbox_events: Transactional Outbox Pattern schema.
-- Decouples domain event writes from external notification dispatch.
-- Ensures at-least-once delivery without dual-write distributed transaction hazards.

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | published | failed
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_events(status, created_at);
