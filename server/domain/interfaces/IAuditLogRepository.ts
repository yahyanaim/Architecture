import { AuditLogEntry } from '../entities/AuditLogEntry';

export interface AuditLogQueryFilters {
  orgId: string;
  actorId?: string;
  event?: string;
  limit?: number;
  offset?: number;
}

export interface IAuditLogRepository {
  save(entry: AuditLogEntry): Promise<void>;
  query(filters: AuditLogQueryFilters): Promise<{ entries: AuditLogEntry[]; total: number }>;
}
