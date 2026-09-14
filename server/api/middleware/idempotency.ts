import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../../infrastructure/database';
import { DATABASE_URL } from '../../config/index';
import { pgExecutor } from '../../infrastructure/pg';

interface IdempotencyRow {
  key: string;
  org_id: string | null;
  user_id: string | null;
  request_path: string;
  request_hash: string;
  response_status: number;
  response_body: string;
  created_at: string;
  expires_at: string;
}

const isPostgresActive = Boolean(DATABASE_URL && DATABASE_URL.trim().length > 0);

export function idempotency(req: Request, res: Response, next: NextFunction): void {
  // Only intercept POST requests
  if (req.method !== 'POST') {
    next();
    return;
  }

  const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!rawKey) {
    next();
    return;
  }

  const idempotencyKey = String(rawKey).trim();
  if (idempotencyKey.length === 0 || idempotencyKey.length > 255) {
    res.status(400).json({ message: 'Invalid Idempotency-Key header length. Must be between 1 and 255 characters.' });
    return;
  }

  const bodyString = req.body ? JSON.stringify(req.body) : '';
  const requestHash = crypto
    .createHash('sha256')
    .update(`${req.method}:${req.originalUrl || req.url}:${bodyString}`)
    .digest('hex');

  const now = new Date();

  (async () => {
    try {
      let existing: IdempotencyRow | null = null;

      if (isPostgresActive) {
        try {
          const result = await pgExecutor.query<IdempotencyRow>(
            'SELECT * FROM idempotency_keys WHERE key = $1',
            [idempotencyKey]
          );
          existing = result.rows[0] ?? null;
        } catch {
          // Table might not exist yet
        }
      } else {
        try {
          existing =
            (db.prepare('SELECT * FROM idempotency_keys WHERE key = ?').get(idempotencyKey) as IdempotencyRow) ?? null;
        } catch {
          // Table might not exist yet
        }
      }

      if (existing) {
        const expiresAt = new Date(existing.expires_at);
        if (expiresAt > now) {
          if (existing.request_hash !== requestHash) {
            res.status(422).json({
              message: 'Idempotency-Key already used with different request payload.',
              code: 'IDEMPOTENCY_CONFLICT',
            });
            return;
          }

          res.setHeader('Idempotency-Replayed', 'true');
          res.setHeader('Idempotency-Key', idempotencyKey);
          res.status(existing.response_status);

          try {
            const parsed = JSON.parse(existing.response_body);
            res.json(parsed);
          } catch {
            res.send(existing.response_body);
          }
          return;
        }
      }

      const originalSend = res.send;
      let bodySent: any = null;

      res.send = function (chunk: any) {
        bodySent = chunk;
        return originalSend.apply(this, arguments as any);
      };

      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 500 && bodySent != null) {
          const bodyToStore = typeof bodySent === 'string' ? bodySent : JSON.stringify(bodySent);
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const orgId = (req as any).tenant?.orgId || null;
          const userId = (req as any).user?.userId || (req as any).account?.id || null;

          if (isPostgresActive) {
            pgExecutor
              .query(
                `INSERT INTO idempotency_keys (key, org_id, user_id, request_path, request_hash, response_status, response_body, created_at, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT(key) DO UPDATE SET
                   response_status = EXCLUDED.response_status,
                   response_body = EXCLUDED.response_body,
                   expires_at = EXCLUDED.expires_at`,
                [
                  idempotencyKey,
                  orgId,
                  userId,
                  req.originalUrl || req.url,
                  requestHash,
                  res.statusCode,
                  bodyToStore,
                  now.toISOString(),
                  expiresAt.toISOString(),
                ]
              )
              .catch(() => undefined);
          } else {
            try {
              db.prepare(
                `INSERT INTO idempotency_keys (key, org_id, user_id, request_path, request_hash, response_status, response_body, created_at, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET
                   response_status = excluded.response_status,
                   response_body = excluded.response_body,
                   expires_at = excluded.expires_at`
              ).run(
                idempotencyKey,
                orgId,
                userId,
                req.originalUrl || req.url,
                requestHash,
                res.statusCode,
                bodyToStore,
                now.toISOString(),
                expiresAt.toISOString()
              );
            } catch {
              // Non-blocking catch
            }
          }
        }
      });

      next();
    } catch (err) {
      next(err);
    }
  })();
}
