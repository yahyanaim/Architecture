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

// -- In-memory request metrics (per-process; scrape via GET /api/metrics).
// For multi-instance prod, replace with a StatsD/Prometheus client here —
interface RouteStat { count: number; errors: number; totalMs: number }
const stats = new Map<string, RouteStat>();

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const route = `${req.method} ${req.route?.path ? req.baseUrl + req.route.path : req.baseUrl || req.path}`;
    const s = stats.get(route) ?? { count: 0, errors: 0, totalMs: 0 };
    s.count += 1;
    if (res.statusCode >= 500) s.errors += 1;
    s.totalMs += Date.now() - start;
    stats.set(route, s);
  });
  next();
}

export function getMetricsSnapshot(): Record<string, { count: number; errors: number; avgMs: number }> {
  const out: Record<string, { count: number; errors: number; avgMs: number }> = {};
  for (const [route, s] of stats) {
    out[route] = { count: s.count, errors: s.errors, avgMs: s.count ? Math.round(s.totalMs / s.count) : 0 };
  }
  return out;
}
