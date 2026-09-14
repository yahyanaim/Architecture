import { WebhookEndpoint } from '../entities/WebhookEndpoint';
import { WebhookDelivery } from '../entities/WebhookDelivery';

export interface IWebhookRepository {
  saveEndpoint(endpoint: WebhookEndpoint): Promise<void>;
  findEndpointById(id: string, orgId: string): Promise<WebhookEndpoint | null>;
  listEndpoints(orgId: string): Promise<WebhookEndpoint[]>;
  listActiveEndpointsForEvent(orgId: string, eventType: string): Promise<WebhookEndpoint[]>;
  deleteEndpoint(id: string, orgId: string): Promise<boolean>;

  saveDelivery(delivery: WebhookDelivery): Promise<void>;
  updateDelivery(
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
  ): Promise<void>;
  findDeliveryById(id: string, orgId: string): Promise<WebhookDelivery | null>;
  listDeliveries(
    orgId: string,
    endpointId?: string,
    limit?: number,
    offset?: number
  ): Promise<WebhookDelivery[]>;
}
