import fs from 'fs';
import path from 'path';
import { db } from './database';

const AUDIT_LOG_PATH = path.join(process.cwd(), 'data', 'audit.log');

// Audit trail (compliance): dual-persisted (SQLite indexed table + append-only JSONL file)
// for security-sensitive domain events (`user.registered`, `user.deleted`, etc.).
// Called from controllers AFTER mutations succeed. Delivery is best-effort by design.
export function audit(event: string, actorId: string, details: Record<string, unknown> = {}): void {
  const orgId = typeof details.orgId === 'string' ? details.orgId : null;
  const now = new Date();
  const id = globalThis.crypto.randomUUID();
  const entry = {
    id,
    timestamp: now.toISOString(),
    event,
    actorId,
    orgId,
    details,
  };

  const line = JSON.stringify(entry) + '\n';
  console.log('[AUDIT]', JSON.stringify(entry));

  try {
    db.prepare(
      `INSERT INTO audit_logs (id, timestamp, event, actor_id, org_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, entry.timestamp, event, actorId, orgId, JSON.stringify(details));

    // Also persist to transactional outbox for customer webhooks
    const aggregateType = event.split('.')[0] || 'domain';
    const aggregateId = (details.targetUserId as string) || (details.targetId as string) || orgId || actorId;
    db.prepare(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`
    ).run(
      id,
      aggregateType,
      aggregateId,
      event,
      JSON.stringify({ ...details, actorId, orgId }),
      entry.timestamp
    );
  } catch {
    // best-effort persistence — table might not be migrated in very early tests
  }

  const dir = path.dirname(AUDIT_LOG_PATH);
  fs.promises
    .mkdir(dir, { recursive: true })
    .then(() => fs.promises.appendFile(AUDIT_LOG_PATH, line, 'utf-8'))
    .catch(() => {
      // fail silently — audit should never break the app
    });
}

export function emitOutboxEvent(
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>
): void {
  const id = globalThis.crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`
    ).run(id, aggregateType, aggregateId, eventType, JSON.stringify(payload), now);
  } catch {
    // best-effort
  }
}
