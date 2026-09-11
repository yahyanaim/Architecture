import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../database';
import { migrate } from '../db/migrate';
import { SqliteOutboxRepository } from '../repositories/SqliteOutboxRepository';
import { OutboxRelay } from './OutboxRelay';
import { OutboxEvent } from '../../domain/entities/OutboxEvent';

describe('Transactional Outbox Pattern', () => {
  let repo: SqliteOutboxRepository;
  let relay: OutboxRelay;

  beforeEach(() => {
    migrate(db);
    db.prepare('DELETE FROM outbox_events').run();
    repo = new SqliteOutboxRepository();
    relay = new OutboxRelay(repo, 100);
  });

  it('persists and fetches pending outbox events', async () => {
    const event = OutboxEvent.create('user', 'u-123', 'user.created', { email: 'test@example.com' });
    await repo.save(event);

    const pending = await repo.fetchPending(10);
    expect(pending.length).toBe(1);
    expect(pending[0]!.aggregateId).toBe('u-123');
    expect(pending[0]!.eventType).toBe('user.created');
    expect(pending[0]!.status).toBe('pending');
  });

  it('OutboxRelay processes pending events and invokes subscriber handlers', async () => {
    const event = OutboxEvent.create('user', 'u-456', 'user.registered', { email: 'welcome@example.com' });
    await repo.save(event);

    const handler = vi.fn().mockResolvedValue(undefined);
    relay.subscribe('user.registered', handler);

    const processed = await relay.processPending();
    expect(processed).toBe(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: 'u-456',
        eventType: 'user.registered',
      })
    );

    const remaining = await repo.fetchPending();
    expect(remaining.length).toBe(0);

    const row = db.prepare('SELECT * FROM outbox_events WHERE id = ?').get(event.id) as any;
    expect(row.status).toBe('published');
    expect(row.published_at).not.toBeNull();
  });

  it('handles handler failures with retries and exponential status update', async () => {
    const event = OutboxEvent.create('billing', 'org-789', 'invoice.failed', { amount: 100 });
    await repo.save(event);

    const failingHandler = vi.fn().mockRejectedValue(new Error('Network error'));
    relay.subscribe('invoice.failed', failingHandler);

    const processed = await relay.processPending();
    expect(processed).toBe(0);

    const row = db.prepare('SELECT * FROM outbox_events WHERE id = ?').get(event.id) as any;
    expect(row.status).toBe('pending'); // retriable
    expect(row.retry_count).toBe(1);
    expect(row.last_error).toContain('Network error');
  });
});
