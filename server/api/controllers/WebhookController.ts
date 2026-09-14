import { Request, Response, NextFunction } from 'express';
import { IWebhookRepository } from '../../domain/interfaces/IWebhookRepository';
import { WebhookEndpoint } from '../../domain/entities/WebhookEndpoint';
import { WebhookDispatcher } from '../../infrastructure/webhooks/WebhookDispatcher';
import { TenantRequest } from '../middleware/resolveTenant';
import { audit } from '../../infrastructure/audit';
import { JobQueue } from '../../infrastructure/queue';
import {
  CreateWebhookEndpointSchema,
  WebhookEndpointResponseDTO,
  WebhookDeliveryResponseDTO,
} from '../dtos/WebhookDTO';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import {
  parsePaginationParams,
  paginateWithCursor,
  decodeCursor,
} from '../../lib/pagination';

export class WebhookController {
  constructor(
    private readonly webhookRepository: IWebhookRepository,
    private readonly webhookDispatcher: WebhookDispatcher,
    private readonly jobQueue: JobQueue
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const endpoints = await this.webhookRepository.listEndpoints(r.tenant.orgId);
      const items: WebhookEndpointResponseDTO[] = endpoints.map((ep) => ({
        id: ep.id,
        orgId: ep.orgId,
        url: ep.url,
        secret: ep.secret,
        description: ep.description,
        events: ep.events,
        isActive: ep.isActive,
        createdAt: ep.createdAt.toISOString(),
        updatedAt: ep.updatedAt.toISOString(),
      }));

      const { cursor, limit } = parsePaginationParams(
        req.query as Record<string, unknown>,
        50,
        100
      );

      let filtered = items;
      if (cursor) {
        const decoded = decodeCursor<{ id: string }>(cursor);
        if (decoded?.id) {
          const idx = filtered.findIndex((ep) => ep.id === decoded.id);
          if (idx >= 0) filtered = filtered.slice(idx + 1);
        }
      }

      const paginated = paginateWithCursor(filtered, limit, (ep) => ({ id: ep.id }));

      res.setHeader('X-Next-Cursor', paginated.nextCursor || '');
      res.setHeader('X-Has-More', String(paginated.hasMore));

      const isLegacy =
        !req.baseUrl.includes('/v1') &&
        !req.originalUrl.includes('/v1') &&
        req.query.cursor === undefined &&
        req.query.limit === undefined;

      if (isLegacy) {
        res.json(items);
      } else {
        res.json(paginated);
      }
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const parsed = CreateWebhookEndpointSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationException('Invalid webhook data', parsed.error.format());
      }

      const dto = parsed.data;
      const endpoint = WebhookEndpoint.create(
        r.tenant.orgId,
        dto.url,
        dto.events,
        dto.description ?? null,
        dto.secret
      );

      await this.webhookRepository.saveEndpoint(endpoint);

      audit('webhook.created', r.account?.id || 'unknown', {
        endpointId: endpoint.id,
        url: endpoint.url,
        orgId: r.tenant.orgId,
        events: endpoint.events,
      });

      const response: WebhookEndpointResponseDTO = {
        id: endpoint.id,
        orgId: endpoint.orgId,
        url: endpoint.url,
        secret: endpoint.secret,
        description: endpoint.description,
        events: endpoint.events,
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt.toISOString(),
        updatedAt: endpoint.updatedAt.toISOString(),
      };

      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const endpoint = await this.webhookRepository.findEndpointById(
        req.params.id as string,
        r.tenant.orgId
      );

      if (!endpoint) {
        res.status(404).json({ message: 'Webhook endpoint not found' });
        return;
      }

      res.json({
        id: endpoint.id,
        orgId: endpoint.orgId,
        url: endpoint.url,
        secret: endpoint.secret,
        description: endpoint.description,
        events: endpoint.events,
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt.toISOString(),
        updatedAt: endpoint.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const deleted = await this.webhookRepository.deleteEndpoint(
        req.params.id as string,
        r.tenant.orgId
      );

      if (!deleted) {
        res.status(404).json({ message: 'Webhook endpoint not found' });
        return;
      }

      audit('webhook.deleted', r.account?.id || 'unknown', {
        endpointId: req.params.id,
        orgId: r.tenant.orgId,
      });

      res.json({ message: 'Webhook endpoint deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  testPing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const endpoint = await this.webhookRepository.findEndpointById(
        req.params.id as string,
        r.tenant.orgId
      );

      if (!endpoint) {
        res.status(404).json({ message: 'Webhook endpoint not found' });
        return;
      }

      const pingResult = await this.webhookDispatcher.testPing(endpoint);

      audit('webhook.pinged', r.account?.id || 'unknown', {
        endpointId: endpoint.id,
        orgId: r.tenant.orgId,
        success: pingResult.success,
        statusCode: pingResult.statusCode,
      });

      res.json(pingResult);
    } catch (err) {
      next(err);
    }
  };

  listDeliveries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const endpointId = req.params.id || (req.query.endpointId as string) || undefined;
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 100) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const deliveries = await this.webhookRepository.listDeliveries(
        r.tenant.orgId,
        endpointId,
        limit,
        offset
      );

      const items: WebhookDeliveryResponseDTO[] = deliveries.map((d) => ({
        id: d.id,
        endpointId: d.endpointId,
        orgId: d.orgId,
        eventId: d.eventId,
        eventType: d.eventType,
        payload: d.payload,
        responseStatus: d.responseStatus,
        responseBody: d.responseBody,
        error: d.error,
        durationMs: d.durationMs,
        status: d.status,
        attempts: d.attempts,
        deliveredAt: d.deliveredAt ? d.deliveredAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
      }));

      res.json({
        data: items,
        total: items.length,
        limit,
        offset,
      });
    } catch (err) {
      next(err);
    }
  };

  replayDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const deliveryId = req.params.deliveryId as string;

      const delivery = await this.webhookRepository.findDeliveryById(deliveryId, r.tenant.orgId);
      if (!delivery) {
        res.status(404).json({ message: 'Delivery not found or not in workspace' });
        return;
      }

      const endpoint = await this.webhookRepository.findEndpointById(
        delivery.endpointId,
        r.tenant.orgId
      );
      if (!endpoint) {
        res.status(404).json({ message: 'Associated endpoint no longer exists' });
        return;
      }

      // Reset delivery status
      await this.webhookRepository.updateDelivery(delivery.id, r.tenant.orgId, {
        status: 'pending',
        attempts: delivery.attempts + 1,
        error: null,
      });

      // Enqueue job for delivery with 10 max attempts
      await this.jobQueue.enqueue(
        'webhook.deliver',
        {
          deliveryId: delivery.id,
          endpointId: endpoint.id,
          orgId: r.tenant.orgId,
          eventType: delivery.eventType,
          payload: delivery.payload,
          secret: endpoint.secret,
          url: endpoint.url,
        },
        { maxAttempts: 10 }
      );

      audit('webhook.replayed', r.account?.id || 'unknown', {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        orgId: r.tenant.orgId,
      });

      res.json({
        message: 'Webhook delivery re-queued successfully',
        deliveryId: delivery.id,
      });
    } catch (err) {
      next(err);
    }
  };
}
