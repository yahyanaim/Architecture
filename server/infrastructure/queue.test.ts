import { describe, it, expect, beforeAll } from 'vitest';
import { db } from './database';
import { migrate } from './db/migrate';
import { JobQueue } from './queue';

// Queue integration on the real (isolated in-memory) schema: enqueue ->
// processDue runs the handler and marks done; failures back off then die.
describe('job queue', () => {
  beforeAll(() => {
    migrate(db);
  });

  it('processes an email job to the mailer', async () => {
    const sent: any[] = [];
    const q = new JobQueue({ send: async (e: any) => { sent.push(e); } });
    await q.enqueue('email.send', { to: 'a@x.com', subject: 'hi', text: 'yo', kind: 'welcome' });
    const done = await q.processDue();
    expect(done).toBe(1);
    expect(sent).toHaveLength(1);
    expect(q.pendingCount()).toBe(0);
  });

  it('parks unknown job types as dead (no silent loss)', async () => {
    const q = new JobQueue({ send: async () => undefined });
    await q.enqueue('nope.unknown', {});
    await q.processDue();
    const row = db.prepare("SELECT status FROM jobs WHERE type = 'nope.unknown'").get() as any;
    expect(row.status).toBe('dead');
  });

  it('retries failures with backoff, then dies', async () => {
    let calls = 0;
    const q = new JobQueue({ send: async () => undefined });
    q.register('flaky', async () => { calls += 1; throw new Error('boom'); });
    await q.enqueue('flaky', {}, { maxAttempts: 2 });
    await q.processDue(); // attempt 1 -> requeued in future
    expect(calls).toBe(1);
    // Force it due again and exhaust.
    db.prepare("UPDATE jobs SET run_at = '2000-01-01T00:00:00.000Z' WHERE type = 'flaky'").run();
    await q.processDue();
    expect(calls).toBe(2);
    const row = db.prepare("SELECT status, attempts FROM jobs WHERE type = 'flaky'").get() as any;
    expect(row.status).toBe('dead');
    expect(row.attempts).toBe(2);
  });
});
