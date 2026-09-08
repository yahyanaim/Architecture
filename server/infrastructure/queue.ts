import crypto from 'crypto';
import { db } from './database';
import { logger } from './observability';
import { Mailer, Email } from './mailer';

// ============================================================================
// Durable background job queue (SQLite-backed).
//
// WHY: emails (verify/reset/invite), receipts, and webhooks must survive
// restarts and never block HTTP responses — controllers `enqueue()` and
// return immediately; `startWorker()` (called from `server.ts`, skipped in
// tests) leases due rows, runs handlers, and retries with exponential
// backoff. Exhausted jobs park in `dead` for inspection/replay instead of
// vanishing. Single-process worker: for multi-instance prod, run ONE worker
// process or add a `locked_by` lease column (noted, not implemented).
// ============================================================================

export type JobHandler = (payload: any) => Promise<void>;

export interface EmailJobPayload extends Email {
  kind: 'verify' | 'reset' | 'invite' | 'welcome';
}

function now(): string {
  return new Date().toISOString();
}
function uid(): string {
  return crypto.randomUUID();
}

export class JobQueue {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly mailer: Mailer,
    private readonly handlers: Record<string, JobHandler> = {}
  ) {
    // Built-in handler; domain-specific handlers can be registered via the
    // third constructor arg or `register()`.
    this.handlers['email.send'] ??= async (p: EmailJobPayload) => {
      await this.mailer.send(p);
    };
  }

  register(type: string, handler: JobHandler): void {
    this.handlers[type] = handler;
  }

  async enqueue(type: string, payload: Record<string, unknown>, opts: { runAt?: Date; maxAttempts?: number } = {}): Promise<number> {
    const at = (opts.runAt ?? new Date()).toISOString();
    const res = db
      .prepare(
        'INSERT INTO jobs (type, payload, status, run_at, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, NULL, ?, ?)'
      )
      .run(type, JSON.stringify(payload), 'queued', at, opts.maxAttempts ?? 5, now(), now());
    logger.debug('[jobs] enqueued', { type, id: res.lastInsertRowid });
    return Number(res.lastInsertRowid);
  }

  /** Process all due jobs once. Public so tests/cron can drive it manually. */
  async processDue(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      // Reclaim zombie jobs stuck in 'running' for > 10 minutes (e.g. crashed process)
      const zombieCutoff = new Date(Date.now() - 10 * 60_000).toISOString();
      db.prepare("UPDATE jobs SET status = 'queued', attempts = attempts + 1, updated_at = ? WHERE status = 'running' AND updated_at < ?")
        .run(now(), zombieCutoff);

      const due = db
        .prepare("SELECT * FROM jobs WHERE status = 'queued' AND run_at <= ? ORDER BY id ASC LIMIT 20")
        .all(now()) as any[];
      let done = 0;
      for (const job of due) {
        // Atomic claim: only one worker transitions the job from 'queued' to 'running'
        const claim = db
          .prepare("UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ? AND status = 'queued'")
          .run(now(), job.id);
        if (claim.changes === 0) continue; // Claimed by another worker

        const handler = this.handlers[job.type];
        if (!handler) {
          db.prepare("UPDATE jobs SET status = 'dead', last_error = ?, updated_at = ? WHERE id = ?")
            .run(`no handler for type "${job.type}"`, now(), job.id);
          continue;
        }
        try {
          await handler(JSON.parse(job.payload));
          db.prepare("UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ?").run(now(), job.id);
          done += 1;
        } catch (err) {
          const attempts = job.attempts + 1;
          const backoffMin = Math.min(2 ** attempts, 60); // 2,4,8.. capped 60m
          const nextRun = new Date(Date.now() + backoffMin * 60_000).toISOString();
          if (attempts >= job.max_attempts) {
            db.prepare("UPDATE jobs SET status = 'dead', attempts = ?, last_error = ?, updated_at = ? WHERE id = ?")
              .run(attempts, (err as Error).message, now(), job.id);
            logger.error('[jobs] dead', { id: job.id, type: job.type, error: (err as Error).message });
          } else {
            db.prepare("UPDATE jobs SET status = 'queued', attempts = ?, run_at = ?, last_error = ?, updated_at = ? WHERE id = ?")
              .run(attempts, nextRun, (err as Error).message, now(), job.id);
            logger.warn('[jobs] retry scheduled', { id: job.id, type: job.type, attempt: attempts });
          }
        }
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
    logger.info('[jobs] worker started', { intervalMs });
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
