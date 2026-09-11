import crypto from 'crypto';
import { IApiKeyRepository } from '../interfaces/IApiKeyRepository';
import { ApiKey } from '../entities/ApiKey';
import { ValidationException } from '../exceptions/ValidationException';
import { NotFoundException } from '../exceptions/NotFoundException';

export class ApiKeyService {
  constructor(private readonly apiKeyRepository: IApiKeyRepository) {}

  async createApiKey(
    userId: string,
    orgId: string,
    name: string,
    scopes: string[] = ['*'],
    expiresInDays?: number
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    if (!name || name.trim().length < 2) {
      throw new ValidationException('Validation failed', { name: 'API key name must be at least 2 characters' });
    }

    const random = crypto.randomBytes(24).toString('base64url');
    const rawKey = `sk_live_${random}`;
    const keyPrefix = `sk_live_${random.slice(0, 6)}...`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const expiresAt = expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

    const apiKey = new ApiKey(
      globalThis.crypto.randomUUID(),
      orgId,
      userId,
      name.trim(),
      keyPrefix,
      keyHash,
      scopes.length > 0 ? scopes : ['*'],
      expiresAt,
      null,
      new Date()
    );

    await this.apiKeyRepository.save(apiKey);
    return { apiKey, rawKey };
  }

  async listApiKeys(orgId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.findAllByOrg(orgId);
  }

  async revokeApiKey(id: string, orgId: string): Promise<void> {
    const existing = await this.apiKeyRepository.findById(id, orgId);
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    await this.apiKeyRepository.delete(id, orgId);
  }

  async verifyApiKey(rawKey: string): Promise<ApiKey | null> {
    if (!rawKey || !rawKey.startsWith('sk_live_')) {
      return null;
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.apiKeyRepository.findByHash(keyHash);
    if (!apiKey) return null;

    if (apiKey.isExpired()) {
      return null;
    }

    await this.apiKeyRepository.updateLastUsed(apiKey.id, apiKey.orgId);
    return apiKey;
  }
}
