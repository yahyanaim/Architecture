import { Request, Response, NextFunction } from 'express';

// Per-ACCOUNT throttle for credential endpoints (login).
// WHY (defense in depth): the IP rate limiter (`express-rate-limit`) doesn't
// stop distributed guessing (many IPs, one account). This buckets by
// normalized email: 10 attempts / 15 min, then 429. It counts ATTEMPTS, not
// failures, so it also slows credential-stuffing spray. Backed by an
// in-memory Map (single process); move to Redis/SQLite when horizontally
// scaled. Successful logins don't reset it (sliding window is enough here).
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;
const hits = new Map<string, number[]>();

function keyFor(req: Request): string | null {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  if (!email) return null;
  return `login:${email}`;
}

export function loginAccountLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = keyFor(req);
  if (!key) {
    next();
    return;
  }
  const cutoff = Date.now() - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= MAX_ATTEMPTS) {
    res.status(429).json({ message: 'Too many login attempts for this account, please try again later' });
    return;
  }
  recent.push(Date.now());
  hits.set(key, recent);
  // Opportunistic pruning so the map can't grow unboundedly.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.length === 0 || v[v.length - 1]! < cutoff) hits.delete(k);
    }
  }
  next();
}

/** Test hook: clears in-memory counters. */
export function _resetLoginAccountLimiter(): void {
  hits.clear();
}
