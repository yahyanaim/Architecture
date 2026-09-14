import { Request, Response, NextFunction } from 'express';
import { IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';
import { TenantRequest } from '../middleware/resolveTenant';
import { parsePaginationParams, decodeCursor, encodeCursor } from '../../lib/pagination';

export class AuditLogController {
  constructor(private readonly auditLogRepository: IAuditLogRepository) {}

  query = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : undefined;
      const event = typeof req.query.event === 'string' ? req.query.event : undefined;

      const { cursor, limit } = parsePaginationParams(req.query as Record<string, unknown>, 50, 100);
      let offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      if (isNaN(offset) || offset < 0) offset = 0;

      if (cursor) {
        const decoded = decodeCursor<{ offset?: number }>(cursor);
        if (decoded?.offset !== undefined && !isNaN(decoded.offset)) {
          offset = decoded.offset;
        }
      }

      const result = await this.auditLogRepository.query({
        orgId: r.tenant.orgId,
        actorId,
        event,
        limit,
        offset,
      });

      const nextOffset = offset + result.entries.length;
      const hasMore = nextOffset < result.total;
      const nextCursor = hasMore ? encodeCursor({ offset: nextOffset }) : null;

      const entries = result.entries.map((e) => ({
        id: e.id,
        timestamp: e.timestamp.toISOString(),
        event: e.event,
        actorId: e.actorId,
        orgId: e.orgId,
        details: e.details,
      }));

      res.setHeader('X-Next-Cursor', nextCursor || '');
      res.setHeader('X-Has-More', String(hasMore));

      res.json({
        entries,
        total: result.total,
        limit,
        offset,
        data: entries,
        pagination: {
          nextCursor,
          hasMore,
          limit,
        },
        nextCursor,
        hasMore,
      });
    } catch (err) {
      next(err);
    }
  };
}
