import { Request, Response, NextFunction } from 'express';
import { IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';
import { TenantRequest } from '../middleware/resolveTenant';

export class AuditLogController {
  constructor(private readonly auditLogRepository: IAuditLogRepository) {}

  query = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : undefined;
      const event = typeof req.query.event === 'string' ? req.query.event : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await this.auditLogRepository.query({
        orgId: r.tenant.orgId,
        actorId,
        event,
        limit,
        offset,
      });

      res.json({
        entries: result.entries.map((e) => ({
          id: e.id,
          timestamp: e.timestamp.toISOString(),
          event: e.event,
          actorId: e.actorId,
          orgId: e.orgId,
          details: e.details,
        })),
        total: result.total,
        limit,
        offset,
      });
    } catch (err) {
      next(err);
    }
  };
}
