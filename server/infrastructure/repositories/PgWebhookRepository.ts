import { IWebhookRepository } from '../../domain/interfaces/IWebhookRepository';
import { WebhookEndpoint } from '../../domain/entities/WebhookEndpoint';
import { WebhookDelivery, WebhookDeliveryStatus } from '../../domain/entities/WebhookDelivery';
import { pgExecutor } from '../pg';

interface WebhookEndpointRow {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  description: string | null;
  events: string | string[];
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
}

interface WebhookDeliveryRow {
  id: string;
  endpoint_id: string;
  org_id: string;
  event_id: string | null;
  event_type: string;
  payload: string | Record<string, unknown>;
  request_headers: string | Record<string, string>;
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  duration_ms: number | null;
  status: string;
  attempts: number;
  delivered_at: string | null;
  created_at: string;
}

export class PgWebhookRepository implements IWebhookRepository {
  private mapEndpoint(row: WebhookEndpointRow): WebhookEndpoint {
    let parsedEvents: string[] = ['*'];
    if (Array.isArray(row.events)) {
      parsedEvents = row.events;
    } else {
      try {
        parsedEvents = JSON.parse(row.events);
      } catch {
        parsedEvents = ['*'];
      }
    }

    return new WebhookEndpoint(
      row.id,
      row.org_id,
      row.url,
      row.secret,
      row.description,
      parsedEvents,
      Boolean(row.is_active),
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }

  private mapDelivery(row: WebhookDeliveryRow): WebhookDelivery {
    let parsedPayload: Record<string, unknown> = {};
    let parsedHeaders: Record<string, string> = {};

    if (typeof row.payload === 'object' && row.payload !== null) {
      parsedPayload = row.payload;
    } else {
      try {
        parsedPayload = JSON.parse(row.payload as string);
      } catch {
        parsedPayload = {};
      }
    }

    if (typeof row.request_headers === 'object' && row.request_headers !== null) {
      parsedHeaders = row.request_headers;
    } else {
      try {
        parsedHeaders = JSON.parse(row.request_headers as string);
      } catch {
        parsedHeaders = {};
      }
    }

    return new WebhookDelivery(
      row.id,
      row.endpoint_id,
      row.org_id,
      row.event_id,
      row.event_type,
      parsedPayload,
      parsedHeaders,
      row.response_status,
      row.response_body,
      row.error,
      row.duration_ms,
      row.status as WebhookDeliveryStatus,
      row.attempts,
      row.delivered_at ? new Date(row.delivered_at) : null,
      new Date(row.created_at)
    );
  }

  async saveEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    await pgExecutor.query(
      `INSERT INTO webhook_endpoints (id, org_id, url, secret, description, events, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(id) DO UPDATE SET
         url = EXCLUDED.url,
         secret = EXCLUDED.secret,
         description = EXCLUDED.description,
         events = EXCLUDED.events,
         is_active = EXCLUDED.is_active,
         updated_at = EXCLUDED.updated_at
       WHERE webhook_endpoints.org_id = EXCLUDED.org_id`,
      [
        endpoint.id,
        endpoint.orgId,
        endpoint.url,
        endpoint.secret,
        endpoint.description,
        JSON.stringify(endpoint.events),
        endpoint.isActive ? 1 : 0,
        endpoint.createdAt.toISOString(),
        endpoint.updatedAt.toISOString(),
      ]
    );
  }

  async findEndpointById(id: string, orgId: string): Promise<WebhookEndpoint | null> {
    const res = await pgExecutor.query<WebhookEndpointRow>(
      'SELECT * FROM webhook_endpoints WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    return res.rows[0] ? this.mapEndpoint(res.rows[0]) : null;
  }

  async listEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
    const res = await pgExecutor.query<WebhookEndpointRow>(
      'SELECT * FROM webhook_endpoints WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    );
    return res.rows.map((r) => this.mapEndpoint(r));
  }

  async listActiveEndpointsForEvent(orgId: string, eventType: string): Promise<WebhookEndpoint[]> {
    const res = await pgExecutor.query<WebhookEndpointRow>(
      'SELECT * FROM webhook_endpoints WHERE org_id = $1 AND (is_active = 1 OR is_active = true) ORDER BY created_at ASC',
      [orgId]
    );
    const endpoints = res.rows.map((r) => this.mapEndpoint(r));
    return endpoints.filter((ep) => ep.matchesEvent(eventType));
  }

  async deleteEndpoint(id: string, orgId: string): Promise<boolean> {
    const res = await pgExecutor.query(
      'DELETE FROM webhook_endpoints WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async saveDelivery(delivery: WebhookDelivery): Promise<void> {
    await pgExecutor.query(
      `INSERT INTO webhook_deliveries (
        id, endpoint_id, org_id, event_id, event_type, payload,
        request_headers, response_status, response_body, error,
        duration_ms, status, attempts, delivered_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        delivery.id,
        delivery.endpointId,
        delivery.orgId,
        delivery.eventId,
        delivery.eventType,
        JSON.stringify(delivery.payload),
        JSON.stringify(delivery.requestHeaders),
        delivery.responseStatus,
        delivery.responseBody,
        delivery.error,
        delivery.durationMs,
        delivery.status,
        delivery.attempts,
        delivery.deliveredAt ? delivery.deliveredAt.toISOString() : null,
        delivery.createdAt.toISOString(),
      ]
    );
  }

  async updateDelivery(
    id: string,
    orgId: string,
    updates: {
      status?: 'pending' | 'success' | 'failed';
      responseStatus?: number | null;
      responseBody?: string | null;
      error?: string | null;
      durationMs?: number | null;
      attempts?: number;
      deliveredAt?: Date | null;
    }
  ): Promise<void> {
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.status !== undefined) {
      sets.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.responseStatus !== undefined) {
      sets.push(`response_status = $${idx++}`);
      values.push(updates.responseStatus);
    }
    if (updates.responseBody !== undefined) {
      sets.push(`response_body = $${idx++}`);
      values.push(updates.responseBody);
    }
    if (updates.error !== undefined) {
      sets.push(`error = $${idx++}`);
      values.push(updates.error);
    }
    if (updates.durationMs !== undefined) {
      sets.push(`duration_ms = $${idx++}`);
      values.push(updates.durationMs);
    }
    if (updates.attempts !== undefined) {
      sets.push(`attempts = $${idx++}`);
      values.push(updates.attempts);
    }
    if (updates.deliveredAt !== undefined) {
      sets.push(`delivered_at = $${idx++}`);
      values.push(updates.deliveredAt ? updates.deliveredAt.toISOString() : null);
    }

    if (sets.length === 0) return;

    values.push(id, orgId);
    await pgExecutor.query(
      `UPDATE webhook_deliveries SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx++}`,
      values
    );
  }

  async findDeliveryById(id: string, orgId: string): Promise<WebhookDelivery | null> {
    const res = await pgExecutor.query<WebhookDeliveryRow>(
      'SELECT * FROM webhook_deliveries WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    return res.rows[0] ? this.mapDelivery(res.rows[0]) : null;
  }

  async listDeliveries(
    orgId: string,
    endpointId?: string,
    limit = 50,
    offset = 0
  ): Promise<WebhookDelivery[]> {
    if (endpointId) {
      const res = await pgExecutor.query<WebhookDeliveryRow>(
        'SELECT * FROM webhook_deliveries WHERE endpoint_id = $1 AND org_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
        [endpointId, orgId, limit, offset]
      );
      return res.rows.map((r) => this.mapDelivery(r));
    }

    const res = await pgExecutor.query<WebhookDeliveryRow>(
      'SELECT * FROM webhook_deliveries WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [orgId, limit, offset]
    );
    return res.rows.map((r) => this.mapDelivery(r));
  }
}
