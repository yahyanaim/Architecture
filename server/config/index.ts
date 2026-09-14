// ============================================================================
// Composition root — centralized runtime configuration.
//
// ARCHITECTURE NOTE: this is the only place (besides `server.ts`) that may
// read `process.env` for backend settings. Every other layer (API / domain /
// infrastructure) receives plain values via constructor injection or imports
// from here, so environment handling never leaks into business logic.
// ============================================================================

const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const IS_PROD = NODE_ENV === 'production';

// SECURITY: the JWT signing secret must never fall back to a hardcoded value
// in production — a predictable secret lets anyone forge admin tokens.
// Fail closed at boot instead of serving insecurely.
if (IS_PROD && !process.env.JWT_SECRET) {
  throw new Error('Missing required env var: JWT_SECRET (refusing to boot in production without it)');
}
// In dev/test a default keeps the starter runnable; tests override via
// `vitest.config.ts` (`test.env.JWT_SECRET`).
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-12345678901234567890';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// SESSION LIFECYCLE (SaaS auth): short-lived access JWT + long-lived opaque
// refresh token (rotated server-side, revocable). A stolen access token is
// only useful for minutes; refresh reuse triggers chain revocation.
export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
export const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);

/** Parses '15m'/'2h'/'7d'/'30s' into ms for cookie maxAge. */
export function parseTtlMs(ttl: string, fallbackMs: number): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(ttl.trim());
  if (!m || !m[1] || !m[2]) return fallbackMs;
  const n = parseInt(m[1], 10);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

export const ACCESS_COOKIE_MAX_AGE_MS = parseTtlMs(ACCESS_TOKEN_TTL, 15 * 60_000);
export const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TOKEN_TTL_DAYS * 86_400_000;

// Public base URL used to build email links (verify / reset / invite).
export const APP_URL = process.env.APP_URL || 'http://localhost:40001';

// Observability knobs. `ERROR_WEBHOOK_URL` (Slack/PagerDuty/ingest endpoint)
// receives fire-and-forget 5xx reports; unset = log only.
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const ERROR_WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL || '';

// Billing (Stripe). All optional: when STRIPE_SECRET_KEY is unset the
// checkout/portal endpoints answer 501 (fail-explicit) while the webhook
// rejects everything (no secret = cannot verify). Price ids map Stripe
// prices to our plans (see priceToPlan in infrastructure/billing.ts).
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
export const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || '';
export const STRIPE_PRICE_ENTERPRISE = process.env.STRIPE_PRICE_ENTERPRISE || '';

// CORS allowlist. `.env` documents a comma-separated list, so split it here
// into a real array — passing the raw string to `cors({ origin })` would only
// ever match a single origin and silently reject the rest.
export const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:4000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Express `trust proxy` controls how `req.ip` (used by rate limiters) is
// derived behind a reverse proxy. Keep it configurable: '1' for a single
// proxy (most PaaS), '0' for direct exposure.
export const TRUST_PROXY = process.env.TRUST_PROXY ?? '1';
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 40001;

// Database URL (Postgres connection string).
// When unset, the application boots using local SQLite (better-sqlite3) for dev/test.
// When set, the application connects to PostgreSQL for production multi-instance operation.
export const DATABASE_URL = process.env.DATABASE_URL?.trim() || '';

// Redis URL for distributed rate limiting, queue locking, and telemetry.
// When unset, in-memory fallbacks are used automatically.
export const REDIS_URL = process.env.REDIS_URL?.trim() || '';

// Mailer configuration:
// MAILER_DRIVER='log' writes .eml files to data/outbox/ (dev/test).
// MAILER_DRIVER='resend' delivers live emails via Resend API using RESEND_API_KEY.
export const MAILER_DRIVER = (process.env.MAILER_DRIVER?.trim() || 'log') as 'log' | 'resend';
export const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || '';
export const MAIL_FROM = process.env.MAIL_FROM?.trim() || 'noreply@example.com';

// Storage configuration:
// STORAGE_DRIVER='local' stores uploaded files in data/uploads/ (dev/test).
// STORAGE_DRIVER='s3' uploads files to AWS S3, Cloudflare R2, MinIO, etc.
export const STORAGE_DRIVER = (process.env.STORAGE_DRIVER?.trim() || 'local') as 'local' | 's3';
export const S3_BUCKET = process.env.S3_BUCKET?.trim() || '';
export const S3_REGION = process.env.S3_REGION?.trim() || 'us-east-1';
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim() || '';
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';
export const S3_ENDPOINT = process.env.S3_ENDPOINT?.trim() || '';

// OAuth / OIDC Provider Credentials (Google & GitHub)
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID?.trim() || '';
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET?.trim() || '';

export default {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  APP_URL,
  LOG_LEVEL,
  ERROR_WEBHOOK_URL,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_PRO,
  STRIPE_PRICE_ENTERPRISE,
  CORS_ORIGINS,
  TRUST_PROXY,
  PORT,
  IS_PROD,
  DATABASE_URL,
  REDIS_URL,
  MAILER_DRIVER,
  RESEND_API_KEY,
  MAIL_FROM,
  STORAGE_DRIVER,
  S3_BUCKET,
  S3_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
};