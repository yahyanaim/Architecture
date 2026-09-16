import crypto from 'crypto';
import { db } from './database';
import { logger, getTraceContext, runWithTraceContext } from './observability';
import { Mailer, Email } from './mailer';
import { APP_URL } from '../config/index';

// ============================================================================
// Durable background job queue (SQLite / Postgres compatible).
//
// WHY: emails (verify/reset/invite), receipts, and webhooks must survive
// restarts and never block HTTP responses — controllers `enqueue()` and
// return immediately; `startWorker()` (called from `server.ts`, skipped in
// tests) leases due rows, runs handlers, and retries with exponential
// backoff. Exhausted jobs park in `dead` for inspection/replay instead of
// vanishing.
//
// MULTI-INSTANCE SAFETY:
// Workers lease jobs using atomic `UPDATE ... WHERE status='queued' AND (locked_by IS NULL) RETURNING *`.
// Each worker tags claimed jobs with its unique `workerId` and timestamp `locked_at`.
// Zombie/crashed workers have their leases reclaimed after lease timeout (10m).
// ============================================================================

export type JobHandler = (payload: any) => Promise<void>;

export interface EmailJobPayload extends Email {
  kind: 'verify' | 'reset' | 'invite' | 'welcome' | 'dunning';
}

export interface JobRecord {
  id: number;
  type: string;
  payload: string;
  status: string;
  run_at: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

function now(): string {
  return new Date().toISOString();
}

export class JobQueue {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  readonly workerId: string;

  constructor(
    private readonly mailer: Mailer,
    private readonly handlers: Record<string, JobHandler> = {},
    workerId?: string
  ) {
    this.workerId = workerId ?? `worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
    // Built-in handler; domain-specific handlers can be registered via the
    // third constructor arg or `register()`.
    this.handlers['email.send'] ??= async (p: EmailJobPayload) => {
      await this.mailer.send(p);
    };

    this.handlers['billing.dunning'] ??= async (p: {
      orgId: string;
      subscriptionId: string;
      email: string;
      day: number;
      graceUntil?: string;
    }) => {
      let subject = '';
      let text = '';
      if (p.day === 0) {
        subject = 'Action Required: Payment Failed (7-Day Grace Period Active)';
        text = `Your subscription payment failed. Your workspace keeps working during a 7-day grace period. Please update your payment method: ${APP_URL}/billing`;
      } else if (p.day === 3) {
        subject = 'Reminder: 4 Days Remaining on Your Workspace Grace Period';
        text = `Your payment is still pending. 4 days remain before your workspace access is suspended. Please update your payment method: ${APP_URL}/billing`;
      } else {
        subject = 'Workspace Suspended: Grace Period Expired';
        text = `Your 7-day grace period has expired and paid workspace access has been suspended. Please update your payment method to restore access: ${APP_URL}/billing`;
      }
      await this.mailer.send({
        to: p.email,
        subject,
        text,
      });
    };

    this.handlers['user.purge'] ??= async (p: { userId: string }) => {
      hardPurgeUser(p.userId);
    };
  }

  register(type: string, handler: JobHandler): void {
    this.handlers[type] = handler;
  }

  async enqueue(type: string, payload: Record<string, unknown>, opts: { runAt?: Date; maxAttempts?: number } = {}): Promise<number> {
    const at = (opts.runAt ?? new Date()).toISOString();
    const activeCtx = getTraceContext();
    const traceId = (payload._traceId as string) || activeCtx?.traceId || crypto.randomUUID();
    const payloadWithTrace = { ...payload, _traceId: traceId };
    const res = db
      .prepare(
        'INSERT INTO jobs (type, payload, status, run_at, attempts, max_attempts, last_error, locked_by, locked_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, NULL, NULL, NULL, ?, ?)'
      )
      .run(type, JSON.stringify(payloadWithTrace), 'queued', at, opts.maxAttempts ?? 5, now(), now());
    logger.debug('[jobs] enqueued', { type, id: res.lastInsertRowid, traceId });
    return Number(res.lastInsertRowid);
  }

  /**
   * Atomically claims the next due job for this worker instance.
   * Uses atomic UPDATE ... WHERE status='queued' AND (locked_by IS NULL) RETURNING *
   * to guarantee no double-execution across multiple instances.
   */
  claimNextJob(): JobRecord | undefined {
    const currentTime = now();
    const claimStmt = db.prepare(`
      UPDATE jobs
      SET status = 'running', locked_by = ?, locked_at = ?, updated_at = ?
      WHERE id = (
        SELECT id FROM jobs
        WHERE status = 'queued'
          AND (locked_by IS NULL)
          AND run_at <= ?
        ORDER BY id ASC
        LIMIT 1
      )
      AND status = 'queued'
      AND (locked_by IS NULL)
      RETURNING *
    `);
    return claimStmt.get(this.workerId, currentTime, currentTime, currentTime) as JobRecord | undefined;
  }

  /** Process all due jobs once. Public so tests/cron can drive it manually. */
  async processDue(batchLimit = 20): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      // Reclaim zombie jobs stuck in 'running' for > 10 minutes (e.g. crashed process)
      const zombieCutoff = new Date(Date.now() - 10 * 60_000).toISOString();
      db.prepare(
        "UPDATE jobs SET status = 'queued', attempts = attempts + 1, locked_by = NULL, locked_at = NULL, updated_at = ? WHERE status = 'running' AND (updated_at < ? OR locked_at < ?)"
      ).run(now(), zombieCutoff, zombieCutoff);

      let done = 0;
      for (let i = 0; i < batchLimit; i++) {
        // Atomic claim: only one worker transitions the job from 'queued' to 'running'
        const job = this.claimNextJob();
        if (!job) break; // No more due jobs to claim

        const handler = this.handlers[job.type];
        if (!handler) {
          db.prepare("UPDATE jobs SET status = 'dead', locked_by = NULL, locked_at = NULL, last_error = ?, updated_at = ? WHERE id = ?")
            .run(`no handler for type "${job.type}"`, now(), job.id);
          continue;
        }

        const rawPayload = JSON.parse(job.payload);
        const traceId = (rawPayload && typeof rawPayload === 'object' && rawPayload._traceId)
          ? String(rawPayload._traceId)
          : `job-${job.id}`;

        await runWithTraceContext({ traceId, requestId: traceId }, async () => {
          try {
            await handler(rawPayload);
            db.prepare("UPDATE jobs SET status = 'done', locked_by = NULL, locked_at = NULL, updated_at = ? WHERE id = ?")
              .run(now(), job.id);
            done += 1;
          } catch (err) {
            const attempts = job.attempts + 1;
            const backoffMin = Math.min(2 ** attempts, 60); // 2,4,8.. capped 60m
            const nextRun = new Date(Date.now() + backoffMin * 60_000).toISOString();
            if (attempts >= job.max_attempts) {
              db.prepare(
                "UPDATE jobs SET status = 'dead', locked_by = NULL, locked_at = NULL, attempts = ?, last_error = ?, updated_at = ? WHERE id = ?"
              ).run(attempts, (err as Error).message, now(), job.id);
              logger.error('[jobs] dead', { id: job.id, type: job.type, traceId, error: (err as Error).message });
            } else {
              db.prepare(
                "UPDATE jobs SET status = 'queued', locked_by = NULL, locked_at = NULL, attempts = ?, run_at = ?, last_error = ?, updated_at = ? WHERE id = ?"
              ).run(attempts, nextRun, (err as Error).message, now(), job.id);
              logger.warn('[jobs] retry scheduled', { id: job.id, type: job.type, attempt: attempts, traceId });
            }
          }
        });
      }

      // Opportunistic cleanup of long-expired refresh rows is handled by
      // AuthService; jobs table keeps `done` rows 7d for audit, then prunes.
      db.prepare("DELETE FROM jobs WHERE status = 'done' AND updated_at < ?")
        .run(new Date(Date.now() - 7 * 24 * 3600_000).toISOString());
      return done;
    } finally {
      this.running = false;
    }
  }

  startWorker(intervalMs = 10_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.processDue().catch((e) => logger.error('[jobs] worker tick failed', { error: (e as Error).message }));
    }, intervalMs);
    this.timer.unref?.(); // never keep the process alive on its own
    logger.info('[jobs] worker started', { workerId: this.workerId, intervalMs });
  }

  stopWorker(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  pendingCount(): number {
    const r = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('queued','running')").get() as { n: number };
    return r.n;
  }
}

/**
 * Permanently deletes a user and associated personal records across all tables (GDPR Hard Purge).
 */
export function hardPurgeUser(userId: string): void {
  try {
    db.prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
  } catch {}
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  } catch {}
  logger.info('[jobs] GDPR hard purge completed for user', { userId });
}

/**
 * Sweeps and permanently purges any users whose 30-day soft-delete retention has elapsed.
 */
export function hardPurgeDueUsers(now: Date = new Date()): number {
  try {
    const rows = db.prepare('SELECT id FROM users WHERE deleted_at IS NOT NULL AND purge_due_at <= ?').all(now.toISOString()) as { id: string }[];
    for (const r of rows) {
      hardPurgeUser(r.id);
    }
    return rows.length;
  } catch {
    return 0;
  }
}

