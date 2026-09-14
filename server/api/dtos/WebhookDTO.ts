import { z } from 'zod';

export const CreateWebhookEndpointSchema = z.object({
  url: z.string().url('Invalid webhook URL format'),
  description: z.string().max(255).optional().nullable(),
  events: z.array(z.string()).default(['*']),
  secret: z.string().min(16, 'Secret must be at least 16 characters').optional(),
});

export type CreateWebhookEndpointDTO = z.infer<typeof CreateWebhookEndpointSchema>;

export const UpdateWebhookEndpointSchema = z.object({
  url: z.string().url('Invalid webhook URL format').optional(),
  description: z.string().max(255).optional().nullable(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWebhookEndpointDTO = z.infer<typeof UpdateWebhookEndpointSchema>;

export interface WebhookEndpointResponseDTO {
  id: string;
  orgId: string;
  url: string;
  secret: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryResponseDTO {
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
