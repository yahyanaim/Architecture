import { Request, Response, NextFunction } from 'express';
import { LOG_LEVEL, ERROR_WEBHOOK_URL } from '../config/index';

// ============================================================================
// Observability: structured logs + request metrics + error reporting hook.
// Zero dependencies by design — swap transports (Sentry/Pino/OTel) here
// without touching call sites.
// ============================================================================

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN: Level = (['debug', 'info', 'warn', 'error'] as Level[]).includes(LOG_LEVEL as Level)
  ? (LOG_LEVEL as Level)
  : 'info';

function emit(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (ORDER[level] < ORDER[MIN]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, pid: process.pid, ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
  /** Logger bound to a request (propagates `x-request-id` into every line). */
  forRequest: (req: Request) => ({
    debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, { requestId: (req as any).requestId, ...fields }),
    info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, { requestId: (req as any).requestId, ...fields }),
    warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, { requestId: (req as any).requestId, ...fields }),
    error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, { requestId: (req as any).requestId, ...fields }),
  }),
};

/** Fire-and-forget 5xx reporter. Never throws, never blocks the response. */
export function reportError(err: Error, ctx: Record<string, unknown> = {}): void {
  logger.error(err.message, { ...ctx, stack: err.stack });
  if (!ERROR_WEBHOOK_URL) return;
  try {
    void fetch(ERROR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `5xx: ${err.message}`, ctx, at: new Date().toISOString() }),
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
