-- 002_billing: Stripe customer link, dunning grace, webhook idempotency.
-- Portable SQL; additive only (never edit 001_init after it has applied).

-- Stripe customer id per org (portal sessions + invoice lookups need it;
-- provider_ref stays the SUBSCRIPTION id).
ALTER TABLE subscriptions ADD COLUMN customer_ref TEXT NULL;

-- Dunning grace: on payment failure the sub goes past_due but keeps access
-- until grace_until. requirePlan reads this via Subscription.hasAccess().
ALTER TABLE subscriptions ADD COLUMN grace_until TEXT NULL;

-- Webhook idempotency ledger: Stripe retries deliveries, so the first insert
-- wins and replays return early. event_id is globally unique per Stripe.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL
);
