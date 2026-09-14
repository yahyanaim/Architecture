import crypto from 'crypto';
import { IWebhookRepository } from '../../domain/interfaces/IWebhookRepository';
import { WebhookEndpoint } from '../../domain/entities/WebhookEndpoint';
import { WebhookDelivery } from '../../domain/entities/WebhookDelivery';
import { OutboxRelay } from '../outbox/OutboxRelay';
import { OutboxEvent } from '../../domain/entities/OutboxEvent';
import { JobQueue } from '../queue';
import { logger } from '../observability';

export interface WebhookJobPayload {
  deliveryId: string;
  endpointId: string;
  orgId: string;
  eventType: string;
  payload: Record<string, unknown>;
  secret: string;
  url: string;
}

export function signWebhookPayload(
  payload: Record<string, unknown>,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): { timestamp: number; signature: string; header: string } {
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payloadString}`)
    .digest('hex');
  return {
    timestamp,
    signature,
    header: `t=${timestamp},v1=${signature}`,
  };
}

export class WebhookDispatcher {
  constructor(
    private readonly webhookRepository: IWebhookRepository,
    private readonly jobQueue: JobQueue
  ) {}

  async deliver(job: WebhookJobPayload): Promise<void> {
    const { timestamp, header: sigHeader } = signWebhookPayload(job.payload, job.secret);
    const bodyString = JSON.stringify(job.payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Nexora-Webhooks/1.0',
      'X-Webhook-Event': job.eventType,
      'X-Webhook-Delivery': job.deliveryId,
      'X-Webhook-Timestamp': String(timestamp),
      'X-Webhook-Signature': sigHeader,
    };

    const start = Date.now();
    try {
      const res = await fetch(job.url, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: AbortSignal.timeout(10000),
      });

      const durationMs = Date.now() - start;
      const text = await res.text().catch(() => '');

      if (res.ok) {
        await this.webhookRepository.updateDelivery(job.deliveryId, job.orgId, {
          status: 'success',
          responseStatus: res.status,
          responseBody: text.slice(0, 2048),
          durationMs,
          deliveredAt: new Date(),
        });
        logger.info('[webhook] delivered successfully', {
          deliveryId: job.deliveryId,
          endpointId: job.endpointId,
          status: res.status,
          durationMs,
        });
      } else {
        const errorMsg = `HTTP ${res.status} ${res.statusText || 'Error'}`;
        await this.webhookRepository.updateDelivery(job.deliveryId, job.orgId, {
          status: 'failed',
          responseStatus: res.status,
          responseBody: text.slice(0, 2048),
          durationMs,
          error: errorMsg,
        });
        logger.warn('[webhook] delivery responded with non-2xx', {
          deliveryId: job.deliveryId,
          status: res.status,
          durationMs,
        });
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      const durationMs = Date.now() - start;
      await this.webhookRepository.updateDelivery(job.deliveryId, job.orgId, {
        status: 'failed',
        durationMs,
        error: err.message ?? 'Network error',
      });
      logger.error('[webhook] delivery network/timeout error', {
        deliveryId: job.deliveryId,
        error: err.message,
        durationMs,
      });
      throw err;
    }
  }

  async testPing(endpoint: WebhookEndpoint): Promise<{
    success: boolean;
    statusCode: number | null;
    durationMs: number;
    error: string | null;
    signature: string;
    deliveryId: string;
  }> {
    const pingPayload: Record<string, unknown> = {
      event: 'ping',
      timestamp: new Date().toISOString(),
      endpointId: endpoint.id,
      orgId: endpoint.orgId,
      message: 'Test ping from Nexora webhook system',
    };

    const delivery = WebhookDelivery.create(
      endpoint.id,
      endpoint.orgId,
      'ping',
      pingPayload
    );

    const { timestamp, signature, header: sigHeader } = signWebhookPayload(
      pingPayload,
      endpoint.secret
    );

    delivery.requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Nexora-Webhooks/1.0',
      'X-Webhook-Event': 'ping',
      'X-Webhook-Delivery': delivery.id,
      'X-Webhook-Timestamp': String(timestamp),
      'X-Webhook-Signature': sigHeader,
    };

    await this.webhookRepository.saveDelivery(delivery);

    const start = Date.now();
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: delivery.requestHeaders,
        body: JSON.stringify(pingPayload),
        signal: AbortSignal.timeout(10000),
      });

      const durationMs = Date.now() - start;
      const text = await res.text().catch(() => '');

      if (res.ok) {
        await this.webhookRepository.updateDelivery(delivery.id, endpoint.orgId, {
          status: 'success',
          responseStatus: res.status,
          responseBody: text.slice(0, 2048),
          durationMs,
          deliveredAt: new Date(),
        });
        return {
          success: true,
          statusCode: res.status,
          durationMs,
          error: null,
          signature,
          deliveryId: delivery.id,
        };
      } else {
        const errorMsg = `HTTP ${res.status} ${res.statusText || 'Error'}`;
        await this.webhookRepository.updateDelivery(delivery.id, endpoint.orgId, {
          status: 'failed',
          responseStatus: res.status,
          responseBody: text.slice(0, 2048),
          durationMs,
          error: errorMsg,
        });
        return {
          success: false,
          statusCode: res.status,
          durationMs,
          error: errorMsg,
          signature,
          deliveryId: delivery.id,
        };
      }
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const errorMsg = err.message || 'Connection failed';
      await this.webhookRepository.updateDelivery(delivery.id, endpoint.orgId, {
        status: 'failed',
        durationMs,
        error: errorMsg,
      });
      return {
        success: false,
        statusCode: null,
        durationMs,
        error: errorMsg,
        signature,
        deliveryId: delivery.id,
      };
    }
  }

  async handleOutboxEvent(event: OutboxEvent): Promise<void> {
    const orgId =
      (event.payload.orgId as string) ||
      (event.aggregateType === 'org' || event.aggregateType === 'workspace'
        ? event.aggregateId
        : null);

    if (!orgId) return;

    const endpoints = await this.webhookRepository.listActiveEndpointsForEvent(
      orgId,
      event.eventType
    );

    for (const ep of endpoints) {
      const delivery = WebhookDelivery.create(
        ep.id,
        orgId,
        event.eventType,
        event.payload,
        {},
        event.id
      );

      await this.webhookRepository.saveDelivery(delivery);

      await this.jobQueue.enqueue(
        'webhook.deliver',
        {
          deliveryId: delivery.id,
          endpointId: ep.id,
          orgId,
          eventType: event.eventType,
          payload: event.payload,
          secret: ep.secret,
          url: ep.url,
        },
        { maxAttempts: 10 }
      );
    }
  }

  registerWithSystem(outboxRelay: OutboxRelay): void {
    // 1. Register queue handler on JobQueue for 'webhook.deliver'
    this.jobQueue.register('webhook.deliver', async (payload: WebhookJobPayload) => {
      await this.deliver(payload);
    });

    // 2. Subscribe outbox relay to domain events
    const handler = async (event: OutboxEvent) => {
      await this.handleOutboxEvent(event);
    };

    outboxRelay.subscribe('user.*', handler);
    outboxRelay.subscribe('org.*', handler);
    outboxRelay.subscribe('workspace.*', handler);
    outboxRelay.subscribe('billing.*', handler);
    outboxRelay.subscribe('api_key.*', handler);
  }
}
