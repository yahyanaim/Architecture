import { z } from 'zod';
import { apiClient } from '@/lib/axios';

export const WebhookEndpointSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  url: z.string(),
  secret: z.string(),
  description: z.string().nullable(),
  events: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

export interface CreateWebhookEndpointDTO {
  url: string;
  description?: string | null;
  events?: string[];
  secret?: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  orgId: string;
  eventId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  durationMs: number | null;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  deliveredAt: string | null;
  createdAt: string;
}

export interface TestPingResponse {
  success: boolean;
  statusCode: number | null;
  durationMs: number;
  error: string | null;
  signature: string;
  deliveryId: string;
}

export const webhooksApi = {
  list: async (): Promise<WebhookEndpoint[]> => {
    const res = await apiClient.get('/webhooks');
    const items = Array.isArray(res.data) ? res.data : res.data.data;
    return z.array(WebhookEndpointSchema).parse(items);
  },

  create: async (data: CreateWebhookEndpointDTO): Promise<WebhookEndpoint> => {
    const res = await apiClient.post('/webhooks', data);
    return WebhookEndpointSchema.parse(res.data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/webhooks/${id}`);
  },

  testPing: async (id: string): Promise<TestPingResponse> => {
    const res = await apiClient.post(`/webhooks/${id}/test`);
    return res.data;
  },

  listDeliveries: async (endpointId: string): Promise<WebhookDelivery[]> => {
    const res = await apiClient.get(`/webhooks/${endpointId}/deliveries`);
    return res.data.data || res.data;
  },

  replayDelivery: async (deliveryId: string): Promise<void> => {
    await apiClient.post(`/webhooks/deliveries/${deliveryId}/replay`);
  },
};
