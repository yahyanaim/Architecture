import { db } from '../database';
import {
  IAuditLogRepository,
  AuditLogQueryFilters,
} from '../../domain/interfaces/IAuditLogRepository';
import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';

interface Row {
  id: string;
  timestamp: string;
  event: string;
  actor_id: string;
  org_id: string | null;
  details: string;
}

function toEntity(r: Row): AuditLogEntry {
  return new AuditLogEntry(
    r.id,
    new Date(r.timestamp),
    r.event,
    r.actor_id,
    r.org_id,
    JSON.parse(r.details)
  );
}

export class SqliteAuditLogRepository implements IAuditLogRepository {
  async save(entry: AuditLogEntry): Promise<void> {
    db.prepare(
      `INSERT INTO audit_logs (id, timestamp, event, actor_id, org_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      entry.id,
      entry.timestamp.toISOString(),
      entry.event,
      entry.actorId,
      entry.orgId,
      JSON.stringify(entry.details)
    );
  }

  async query(filters: AuditLogQueryFilters): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);

    let countRow: { count: number };
    let rows: Row[];

    if (filters.actorId && filters.event) {
      countRow = db
        .prepare('SELECT COUNT(*) as count FROM audit_logs WHERE org_id = ? AND actor_id = ? AND event = ?')
        .get(filters.orgId, filters.actorId, filters.event) as { count: number };
      rows = db
        .prepare('SELECT * FROM audit_logs WHERE org_id = ? AND actor_id = ? AND event = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
        .all(filters.orgId, filters.actorId, filters.event, limit, offset) as Row[];
    } else if (filters.actorId) {
      countRow = db
        .prepare('SELECT COUNT(*) as count FROM audit_logs WHERE org_id = ? AND actor_id = ?')
        .get(filters.orgId, filters.actorId) as { count: number };
      rows = db
        .prepare('SELECT * FROM audit_logs WHERE org_id = ? AND actor_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
        .all(filters.orgId, filters.actorId, limit, offset) as Row[];
    } else if (filters.event) {
      countRow = db
        .prepare('SELECT COUNT(*) as count FROM audit_logs WHERE org_id = ? AND event = ?')
        .get(filters.orgId, filters.event) as { count: number };
      rows = db
        .prepare('SELECT * FROM audit_logs WHERE org_id = ? AND event = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
        .all(filters.orgId, filters.event, limit, offset) as Row[];
    } else {
      countRow = db
        .prepare('SELECT COUNT(*) as count FROM audit_logs WHERE org_id = ?')
        .get(filters.orgId) as { count: number };
      rows = db
        .prepare('SELECT * FROM audit_logs WHERE org_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
        .all(filters.orgId, limit, offset) as Row[];
    }

    return {
      entries: rows.map(toEntity),
      total: countRow.count,
    };
  }
}
