import { z } from 'zod';
import { apiClient } from '@/lib/axios';

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  event: z.string(),
  actorId: z.string(),
  orgId: z.string(),
  details: z.record(z.string(), z.any()).or(z.any()),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const AuditLogsResponseSchema = z.object({
  entries: z.array(AuditLogEntrySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type AuditLogsResponse = z.infer<typeof AuditLogsResponseSchema>;

export interface AuditLogQueryParams {
  actorId?: string;
  event?: string;
  limit?: number;
  offset?: number;
}

export const auditLogsApi = {
  getAuditLogs: async (params: AuditLogQueryParams = {}): Promise<AuditLogsResponse> => {
    const searchParams = new URLSearchParams();
    if (params.actorId) searchParams.set('actorId', params.actorId);
    if (params.event) searchParams.set('event', params.event);
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.offset !== undefined) searchParams.set('offset', String(params.offset));

    const response = await apiClient.get(`/admin/audit-logs?${searchParams.toString()}`);
    return AuditLogsResponseSchema.parse(response.data);
  },
};
