import { IWebhookRepository } from '../../domain/interfaces/IWebhookRepository';
import { WebhookEndpoint } from '../../domain/entities/WebhookEndpoint';
import { WebhookDelivery, WebhookDeliveryStatus } from '../../domain/entities/WebhookDelivery';
import { db } from '../database';

interface WebhookEndpointRow {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  description: string | null;
  events: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface WebhookDeliveryRow {
  id: string;
  endpoint_id: string;
  org_id: string;
  event_id: string | null;
  event_type: string;
  payload: string;
  request_headers: string;
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  duration_ms: number | null;
  status: string;
  attempts: number;
  delivered_at: string | null;
  created_at: string;
}

export class SqliteWebhookRepository implements IWebhookRepository {
  private mapEndpoint(row: WebhookEndpointRow): WebhookEndpoint {
    let parsedEvents: string[] = ['*'];
    try {
      parsedEvents = JSON.parse(row.events);
      if (!Array.isArray(parsedEvents)) parsedEvents = ['*'];
    } catch {
      parsedEvents = ['*'];
    }

    return new WebhookEndpoint(
      row.id,
      row.org_id,
      row.url,
      row.secret,
      row.description,
      parsedEvents,
      row.is_active === 1,
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }

  private mapDelivery(row: WebhookDeliveryRow): WebhookDelivery {
    let parsedPayload: Record<string, unknown> = {};
    let parsedHeaders: Record<string, string> = {};

    try {
      parsedPayload = JSON.parse(row.payload);
    } catch {
      parsedPayload = {};
    }

    try {
      parsedHeaders = JSON.parse(row.request_headers);
    } catch {
      parsedHeaders = {};
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
    const stmt = db.prepare(`
      INSERT INTO webhook_endpoints (id, org_id, url, secret, description, events, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        url = excluded.url,
        secret = excluded.secret,
        description = excluded.description,
        events = excluded.events,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
      WHERE webhook_endpoints.org_id = excluded.org_id
    `);

    stmt.run(
      endpoint.id,
      endpoint.orgId,
      endpoint.url,
      endpoint.secret,
      endpoint.description,
      JSON.stringify(endpoint.events),
      endpoint.isActive ? 1 : 0,
      endpoint.createdAt.toISOString(),
      endpoint.updatedAt.toISOString()
    );
  }

  async findEndpointById(id: string, orgId: string): Promise<WebhookEndpoint | null> {
    const row = db
      .prepare('SELECT * FROM webhook_endpoints WHERE id = ? AND org_id = ?')
      .get(id, orgId) as WebhookEndpointRow | undefined;
    return row ? this.mapEndpoint(row) : null;
  }

  async listEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
    const rows = db
      .prepare('SELECT * FROM webhook_endpoints WHERE org_id = ? ORDER BY created_at DESC')
      .all(orgId) as WebhookEndpointRow[];
    return rows.map((r) => this.mapEndpoint(r));
  }

  async listActiveEndpointsForEvent(orgId: string, eventType: string): Promise<WebhookEndpoint[]> {
    const rows = db
      .prepare('SELECT * FROM webhook_endpoints WHERE org_id = ? AND is_active = 1 ORDER BY created_at ASC')
      .all(orgId) as WebhookEndpointRow[];
    const endpoints = rows.map((r) => this.mapEndpoint(r));
    return endpoints.filter((ep) => ep.matchesEvent(eventType));
  }

  async deleteEndpoint(id: string, orgId: string): Promise<boolean> {
    const res = db
      .prepare('DELETE FROM webhook_endpoints WHERE id = ? AND org_id = ?')
      .run(id, orgId);
    return res.changes > 0;
  }

  async saveDelivery(delivery: WebhookDelivery): Promise<void> {
    const stmt = db.prepare(`
      INSERT INTO webhook_deliveries (
        id, endpoint_id, org_id, event_id, event_type, payload,
        request_headers, response_status, response_body, error,
        duration_ms, status, attempts, delivered_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
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
      delivery.deliveredAt?.toISOString() ?? null,
      delivery.createdAt.toISOString()
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

    if (updates.status !== undefined) {
      sets.push('status = ?');
      values.push(updates.status);
    }
    if (updates.responseStatus !== undefined) {
      sets.push('response_status = ?');
      values.push(updates.responseStatus);
    }
    if (updates.responseBody !== undefined) {
      sets.push('response_body = ?');
      values.push(updates.responseBody);
    }
    if (updates.error !== undefined) {
      sets.push('error = ?');
      values.push(updates.error);
    }
    if (updates.durationMs !== undefined) {
      sets.push('duration_ms = ?');
      values.push(updates.durationMs);
    }
    if (updates.attempts !== undefined) {
      sets.push('attempts = ?');
      values.push(updates.attempts);
    }
    if (updates.deliveredAt !== undefined) {
      sets.push('delivered_at = ?');
      values.push(updates.deliveredAt ? updates.deliveredAt.toISOString() : null);
    }

    if (sets.length === 0) return;

    values.push(id, orgId);
    db.prepare(`UPDATE webhook_deliveries SET ${sets.join(', ')} WHERE id = ? AND org_id = ?`).run(
      ...values
    );
  }

  async findDeliveryById(id: string, orgId: string): Promise<WebhookDelivery | null> {
    const row = db
      .prepare('SELECT * FROM webhook_deliveries WHERE id = ? AND org_id = ?')
      .get(id, orgId) as WebhookDeliveryRow | undefined;
    return row ? this.mapDelivery(row) : null;
  }

  async listDeliveries(
    orgId: string,
    endpointId?: string,
    limit = 50,
    offset = 0
  ): Promise<WebhookDelivery[]> {
    if (endpointId) {
      const rows = db
        .prepare(
          'SELECT * FROM webhook_deliveries WHERE endpoint_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
        .all(endpointId, orgId, limit, offset) as WebhookDeliveryRow[];
      return rows.map((r) => this.mapDelivery(r));
    }

    const rows = db
      .prepare(
        'SELECT * FROM webhook_deliveries WHERE org_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      )
      .all(orgId, limit, offset) as WebhookDeliveryRow[];
    return rows.map((r) => this.mapDelivery(r));
  }
}
