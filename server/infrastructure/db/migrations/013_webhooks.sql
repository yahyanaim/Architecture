-- 013_webhooks: Customer-facing outbound webhooks schema.
-- Decouples domain event publishing from webhook endpoint delivery via the transactional outbox.
-- Scoped to organization (org_id) with HMAC-SHA256 signature secrets and delivery tracking.

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  description TEXT NULL,
  events TEXT NOT NULL, -- JSON array of subscribed event patterns, e.g. ["user.*", "org.*", "billing.*"] or ["*"]
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(org_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  request_headers TEXT NOT NULL,
  response_status INTEGER NULL,
  response_body TEXT NULL,
  error TEXT NULL,
  duration_ms INTEGER NULL,
  status TEXT NOT NULL, -- pending | success | failed
  attempts INTEGER NOT NULL DEFAULT 1,
  delivered_at TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON webhook_deliveries(org_id, created_at);
