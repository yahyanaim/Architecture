import { z } from 'zod';
import { apiClient } from '@/lib/axios';

export const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  scopes: z.array(z.string()),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

export const CreateApiKeySchema = z.object({
  name: z.string().min(2, 'Key name must be at least 2 characters'),
  scopes: z.array(z.string()).default(['*']),
  expiresInDays: z.number().int().positive().optional(),
});

export type CreateApiKeyDTO = z.infer<typeof CreateApiKeySchema>;

export const CreatedApiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  rawKey: z.string(),
  scopes: z.array(z.string()),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});

export type CreatedApiKeyResponse = z.infer<typeof CreatedApiKeyResponseSchema>;

export const apiKeysApi = {
  list: async (): Promise<ApiKey[]> => {
    const response = await apiClient.get('/api-keys');
    const items = Array.isArray(response.data) ? response.data : response.data.data;
    return z.array(ApiKeySchema).parse(items);
  },

  create: async (data: CreateApiKeyDTO): Promise<CreatedApiKeyResponse> => {
    CreateApiKeySchema.parse(data);
    const response = await apiClient.post('/api-keys', data);
    return CreatedApiKeyResponseSchema.parse(response.data);
  },

  revoke: async (id: string): Promise<void> => {
    await apiClient.delete(`/api-keys/${id}`);
  },
};
