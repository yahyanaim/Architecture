import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import * as Sentry from '@sentry/node';
import { LOG_LEVEL, ERROR_WEBHOOK_URL, SENTRY_DSN, SENTRY_ENVIRONMENT } from '../config/index';

// ============================================================================
// Observability: structured logs + request metrics + error reporting hook.
// Supports Sentry (@sentry/node) when SENTRY_DSN is configured, AsyncLocalStorage
// for distributed trace propagation, and fire-and-forget 5xx webhooks.
// ============================================================================

export interface TraceContext {
  traceId: string;
  requestId?: string;
  [key: string]: unknown;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

/** Runs a synchronous or asynchronous callback within the provided trace context. */
export function runWithTraceContext<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn);
}

/** Retrieves the current active trace context if present. */
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

let sentryInitialized = false;

/** Initializes Sentry error reporting if DSN is provided. */
export function initSentry(dsn = SENTRY_DSN, environment = SENTRY_ENVIRONMENT): boolean {
  if (!dsn) return false;
  try {
    Sentry.init({
      dsn,
      environment: environment || process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
      integrations: [],
    });
    sentryInitialized = true;
    return true;
  } catch (err) {
    console.error('[sentry] failed to initialize:', err);
    return false;
  }
}

/** Checks whether Sentry is currently active. */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}

/** Cleanly closes and flushes Sentry events. */
export async function closeSentry(timeoutMs = 2000): Promise<void> {
  if (!sentryInitialized) return;
  try {
    await Sentry.close(timeoutMs);
  } catch {
    // Ignore close errors during shutdown
  } finally {
    sentryInitialized = false;
  }
}

// Auto-initialize Sentry at startup if SENTRY_DSN is configured
if (SENTRY_DSN) {
  initSentry();
}

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN: Level = (['debug', 'info', 'warn', 'error'] as Level[]).includes(LOG_LEVEL as Level)
  ? (LOG_LEVEL as Level)
  : 'info';

const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
const SENSITIVE_KEYS = new Set([
  'email',
  'password',
  'secret',
  'token',
  'authorization',
  'creditcard',
  'recoverycode',
  'apikey',
  'keyhash',
]);

/**
 * Recursively masks email addresses and sensitive keys for GDPR / compliance.
 * Emails are redacted to '***'.
 */
export function redactPII(value: unknown): any {
  if (typeof value === 'string') {
    return value.replace(EMAIL_REGEX, '***');
  }
  if (Array.isArray(value)) {
    return value.map(redactPII);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lower = k.toLowerCase();
      if (lower === 'email' || lower.endsWith('email')) {
        out[k] = '***';
      } else if (SENSITIVE_KEYS.has(lower) || lower.includes('password') || lower.includes('secret')) {
        out[k] = '***';
      } else {
        out[k] = redactPII(v);
      }
    }
    return out;
  }
  return value;
}

function emit(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (ORDER[level] < ORDER[MIN]) return;
  const cleanMsg = typeof msg === 'string' ? msg.replace(EMAIL_REGEX, '***') : msg;
  const cleanFields = redactPII(fields) as Record<string, unknown>;
  const activeCtx = getTraceContext();
  const traceFields: Record<string, unknown> = {};
  if (activeCtx?.traceId && cleanFields.traceId === undefined) {
    traceFields.traceId = activeCtx.traceId;
  }
  if (activeCtx?.requestId && cleanFields.requestId === undefined) {
    traceFields.requestId = activeCtx.requestId;
  }
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: cleanMsg,
    pid: process.pid,
    ...traceFields,
    ...cleanFields,
  });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
  /** Logger bound to a request (propagates `x-request-id` and `x-trace-id` into every line). */
  forRequest: (req: Request) => ({
    debug: (msg: string, fields?: Record<string, unknown>) =>
      emit('debug', msg, { requestId: (req as any).requestId, traceId: (req as any).traceId, ...fields }),
    info: (msg: string, fields?: Record<string, unknown>) =>
      emit('info', msg, { requestId: (req as any).requestId, traceId: (req as any).traceId, ...fields }),
    warn: (msg: string, fields?: Record<string, unknown>) =>
      emit('warn', msg, { requestId: (req as any).requestId, traceId: (req as any).traceId, ...fields }),
    error: (msg: string, fields?: Record<string, unknown>) =>
      emit('error', msg, { requestId: (req as any).requestId, traceId: (req as any).traceId, ...fields }),
  }),
};

/** Fire-and-forget 5xx reporter. Dispatches to Sentry and/or ERROR_WEBHOOK_URL. */
export function reportError(err: Error, ctx: Record<string, unknown> = {}): void {
  const activeCtx = getTraceContext();
  const traceId = (ctx.traceId as string) || (ctx.requestId as string) || activeCtx?.traceId;
  const requestId = (ctx.requestId as string) || activeCtx?.requestId;

  const mergedCtx = { ...ctx };
  if (traceId && !mergedCtx.traceId) mergedCtx.traceId = traceId;
  if (requestId && !mergedCtx.requestId) mergedCtx.requestId = requestId;

  logger.error(err.message, { ...mergedCtx, stack: err.stack });

  // 1. Sentry capture when initialized or when DSN is present
  if (sentryInitialized || SENTRY_DSN) {
    if (!sentryInitialized && SENTRY_DSN) {
      initSentry();
    }
    if (sentryInitialized) {
      try {
        Sentry.withScope((scope) => {
          if (traceId) scope.setTag('traceId', traceId);
          if (requestId) scope.setTag('requestId', requestId);
          scope.setTag('node_env', SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development');
          if (ctx.url) scope.setExtra('url', String(ctx.url));
          if (ctx.method) scope.setExtra('method', String(ctx.method));
          const redacted = redactPII(mergedCtx);
          scope.setContext('details', redacted as Record<string, any>);
          Sentry.captureException(err);
        });
      } catch (sentryErr) {
        console.error('[sentry] failed to capture exception:', sentryErr);
      }
    }
  }

  // 2. ERROR_WEBHOOK_URL fallback
  if (!ERROR_WEBHOOK_URL) return;
  try {
    void fetch(ERROR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `5xx: ${err.message}`,
        ctx: redactPII(mergedCtx),
        at: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  } catch {
    // reporting must never break the app
  }
}

// -- Request metrics (in-memory per-process fallback; Redis hash across multi-instance).
// For cloud/Kubernetes setups, scrape Prometheus text format or push to OpenTelemetry.
interface RouteStat { count: number; errors: number; totalMs: number }
const stats = new Map<string, RouteStat>();

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route?.path
      ? `${req.method} ${req.baseUrl + req.route.path}`
      : `${req.method} [unmatched]`;
    const duration = Date.now() - start;

    // Local in-memory counter
    const s = stats.get(route) ?? { count: 0, errors: 0, totalMs: 0 };
    s.count += 1;
    if (res.statusCode >= 500) s.errors += 1;
    s.totalMs += duration;
    stats.set(route, s);

    // Multi-instance distributed counters via Redis
    try {
      // Lazy import / check to avoid circular dependencies
      const { getRedisClient } = require('./redis');
      const redis = getRedisClient?.();
      if (redis) {
        const pipeline = redis.pipeline();
        pipeline.hincrby('metrics:count', route, 1);
        if (res.statusCode >= 500) {
          pipeline.hincrby('metrics:errors', route, 1);
        }
        pipeline.hincrby('metrics:total_ms', route, duration);
        pipeline.exec().catch(() => {});
      }
    } catch {
      // Fail-soft: metric recording must never disrupt requests
    }
  });
  next();
}

/**
 * Returns a consolidated snapshot of route metrics.
 * Reads from shared Redis hash if REDIS_URL is configured, else returns in-memory stats.
 */
export async function getMetricsSnapshot(): Promise<Record<string, { count: number; errors: number; avgMs: number }>> {
  try {
    const { getRedisClient } = require('./redis');
    const redis = getRedisClient?.();
    if (redis) {
      const [counts, errors, totalMs] = await Promise.all([
        redis.hgetall('metrics:count'),
        redis.hgetall('metrics:errors'),
        redis.hgetall('metrics:total_ms'),
      ]);
      const routes = new Set([...Object.keys(counts), ...Object.keys(errors), ...Object.keys(totalMs)]);
      const out: Record<string, { count: number; errors: number; avgMs: number }> = {};
      for (const route of routes) {
        const count = parseInt(counts[route] || '0', 10);
        const errCount = parseInt(errors[route] || '0', 10);
        const ms = parseInt(totalMs[route] || '0', 10);
        out[route] = {
          count,
          errors: errCount,
          avgMs: count > 0 ? Math.round(ms / count) : 0,
        };
      }
      return out;
    }
  } catch {
    // fallback to local stats below
  }

  const out: Record<string, { count: number; errors: number; avgMs: number }> = {};
  for (const [route, s] of stats) {
    out[route] = { count: s.count, errors: s.errors, avgMs: s.count ? Math.round(s.totalMs / s.count) : 0 };
  }
  return out;
}
