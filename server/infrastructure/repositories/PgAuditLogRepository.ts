import { PostgresExecutor, pgExecutor } from '../pg';
import {
  IAuditLogRepository,
  AuditLogQueryFilters,
} from '../../domain/interfaces/IAuditLogRepository';
import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';

interface Row {
  id: string;
  timestamp: string | Date;
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
    typeof r.details === 'string' ? JSON.parse(r.details) : r.details
  );
}

export class PgAuditLogRepository implements IAuditLogRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    this.db = db ?? pgExecutor;
  }

  async save(entry: AuditLogEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (id, timestamp, event, actor_id, org_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.id,
        entry.timestamp.toISOString(),
        entry.event,
        entry.actorId,
        entry.orgId,
        JSON.stringify(entry.details),
      ]
    );
  }

  async query(filters: AuditLogQueryFilters): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);

    let countRes: { count: string | number };
    let rows: Row[];

    if (filters.actorId && filters.event) {
      const cRes = await this.db.query<{ count: string | number }>(
        'SELECT COUNT(*) as count FROM audit_logs WHERE org_id = $1 AND actor_id = $2 AND event = $3',
        [filters.orgId, filters.actorId, filters.event]
      );
      countRes = cRes.rows[0] ?? { count: 0 };
      const rRes = await this.db.query<Row>(
        'SELECT * FROM audit_logs WHERE org_id = $1 AND actor_id = $2 AND event = $3 ORDER BY timestamp DESC LIMIT $4 OFFSET $5',
        [filters.orgId, filters.actorId, filters.event, limit, offset]
      );
      rows = rRes.rows;
    } else if (filters.actorId) {
      const cRes = await this.db.query<{ count: string | number }>(
        'SELECT COUNT(*) as count FROM audit_logs WHERE org_id = $1 AND actor_id = $2',
        [filters.orgId, filters.actorId]
      );
      countRes = cRes.rows[0] ?? { count: 0 };
      const rRes = await this.db.query<Row>(
        'SELECT * FROM audit_logs WHERE org_id = $1 AND actor_id = $2 ORDER BY timestamp DESC LIMIT $3 OFFSET $4',
        [filters.orgId, filters.actorId, limit, offset]
      );
      rows = rRes.rows;
    } else if (filters.event) {
      const cRes = await this.db.query<{ count: string | number }>(
        'SELECT COUNT(*) as count FROM audit_logs WHERE org_id = $1 AND event = $2',
        [filters.orgId, filters.event]
      );
      countRes = cRes.rows[0] ?? { count: 0 };
      const rRes = await this.db.query<Row>(
        'SELECT * FROM audit_logs WHERE org_id = $1 AND event = $2 ORDER BY timestamp DESC LIMIT $3 OFFSET $4',
        [filters.orgId, filters.event, limit, offset]
      );
      rows = rRes.rows;
    } else {
      const cRes = await this.db.query<{ count: string | number }>(
        'SELECT COUNT(*) as count FROM audit_logs WHERE org_id = $1',
        [filters.orgId]
      );
      countRes = cRes.rows[0] ?? { count: 0 };
      const rRes = await this.db.query<Row>(
        'SELECT * FROM audit_logs WHERE org_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
        [filters.orgId, limit, offset]
      );
      rows = rRes.rows;
    }

    return {
      entries: rows.map(toEntity),
      total: Number(countRes.count),
    };
  }
}

export { PgAuditLogRepository as PostgresAuditLogRepository };
