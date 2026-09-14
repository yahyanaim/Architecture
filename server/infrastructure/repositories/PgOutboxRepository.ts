import { PostgresExecutor, pgExecutor } from '../pg';
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
  created_at: string | Date;
  published_at: string | Date | null;
}

function toEntity(r: Row): OutboxEvent {
  return new OutboxEvent(
    r.id,
    r.aggregate_type,
    r.aggregate_id,
    r.event_type,
    typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    r.status as OutboxStatus,
    r.retry_count,
    r.last_error,
    new Date(r.created_at),
    r.published_at ? new Date(r.published_at) : null
  );
}

export class PgOutboxRepository implements IOutboxRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    this.db = db ?? pgExecutor;
  }

  async save(event: OutboxEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, last_error, created_at, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(id) DO UPDATE SET
         status = EXCLUDED.status,
         retry_count = EXCLUDED.retry_count,
         last_error = EXCLUDED.last_error,
         published_at = EXCLUDED.published_at`,
      [
        event.id,
        event.aggregateType,
        event.aggregateId,
        event.eventType,
        JSON.stringify(event.payload),
        event.status,
        event.retryCount,
        event.lastError,
        event.createdAt.toISOString(),
        event.publishedAt?.toISOString() ?? null,
      ]
    );
  }

  async fetchPending(limit = 20): Promise<OutboxEvent[]> {
    const res = await this.db.query<Row>(
      "SELECT * FROM outbox_events WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1",
      [limit]
    );
    return res.rows.map(toEntity);
  }

  async markProcessing(id: string): Promise<boolean> {
    const res = await this.db.query(
      "UPDATE outbox_events SET status = 'processing' WHERE id = $1 AND status = 'pending'",
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async markPublished(id: string): Promise<void> {
    await this.db.query(
      "UPDATE outbox_events SET status = 'published', published_at = $1 WHERE id = $2",
      [new Date().toISOString(), id]
    );
  }

  async markFailed(id: string, error: string, maxRetries = 5): Promise<void> {
    const res = await this.db.query<{ retry_count: number }>(
      'SELECT retry_count FROM outbox_events WHERE id = $1',
      [id]
    );
    const count = (res.rows[0]?.retry_count ?? 0) + 1;
    const newStatus = count >= maxRetries ? 'failed' : 'pending';
    await this.db.query(
      'UPDATE outbox_events SET status = $1, retry_count = $2, last_error = $3 WHERE id = $4',
      [newStatus, count, error, id]
    );
  }
}

export { PgOutboxRepository as PostgresOutboxRepository };
