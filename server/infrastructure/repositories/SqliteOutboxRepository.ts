import { db } from '../database';
import { IOutboxRepository } from '../../domain/interfaces/IOutboxRepository';
import { OutboxEvent, OutboxStatus } from '../../domain/entities/OutboxEvent';

interface Row {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  published_at: string | null;
}

function toEntity(r: Row): OutboxEvent {
  return new OutboxEvent(
    r.id,
    r.aggregate_type,
    r.aggregate_id,
    r.event_type,
    JSON.parse(r.payload),
    r.status as OutboxStatus,
    r.retry_count,
    r.last_error,
    new Date(r.created_at),
    r.published_at ? new Date(r.published_at) : null
  );
}

export class SqliteOutboxRepository implements IOutboxRepository {
  async save(event: OutboxEvent): Promise<void> {
    db.prepare(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, last_error, created_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status=excluded.status, retry_count=excluded.retry_count, last_error=excluded.last_error, published_at=excluded.published_at`
    ).run(
      event.id,
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      JSON.stringify(event.payload),
      event.status,
      event.retryCount,
      event.lastError,
      event.createdAt.toISOString(),
      event.publishedAt?.toISOString() ?? null
    );
  }

  async fetchPending(limit = 20): Promise<OutboxEvent[]> {
    const rows = db
      .prepare("SELECT * FROM outbox_events WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?")
      .all(limit) as Row[];
    return rows.map(toEntity);
  }

  async markProcessing(id: string): Promise<boolean> {
    const res = db
      .prepare("UPDATE outbox_events SET status = 'processing' WHERE id = ? AND status = 'pending'")
      .run(id);
    return res.changes > 0;
  }

  async markPublished(id: string): Promise<void> {
    db.prepare(
      "UPDATE outbox_events SET status = 'published', published_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), id);
  }

  async markFailed(id: string, error: string, maxRetries = 5): Promise<void> {
    const row = db
      .prepare('SELECT retry_count FROM outbox_events WHERE id = ?')
      .get(id) as { retry_count: number } | undefined;
    const count = (row?.retry_count ?? 0) + 1;
    const newStatus = count >= maxRetries ? 'failed' : 'pending';
    db.prepare(
      'UPDATE outbox_events SET status = ?, retry_count = ?, last_error = ? WHERE id = ?'
    ).run(newStatus, count, error, id);
  }
}
