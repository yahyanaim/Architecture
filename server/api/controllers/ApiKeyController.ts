import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../../domain/services/ApiKeyService';
import { TenantRequest } from '../middleware/resolveTenant';
import { audit } from '../../infrastructure/audit';

export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const keys = await this.apiKeyService.listApiKeys(r.tenant.orgId);
      res.json(
        keys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          scopes: k.scopes,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const { name, scopes, expiresInDays } = req.body || {};
      const actorId = r.account?.id || r.user?.userId || 'unknown';
      const { apiKey, rawKey } = await this.apiKeyService.createApiKey(
        actorId,
        r.tenant.orgId,
        name,
        Array.isArray(scopes) ? scopes : ['*'],
        typeof expiresInDays === 'number' ? expiresInDays : undefined
      );

      audit('api_key.created', actorId, {
        targetId: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        orgId: r.tenant.orgId,
      });

      res.status(201).json({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        rawKey, // returned once upon creation
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt?.toISOString() ?? null,
        createdAt: apiKey.createdAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as TenantRequest;
      const id = req.params.id as string;
      await this.apiKeyService.revokeApiKey(id, r.tenant.orgId);

      audit('api_key.revoked', r.account?.id || r.user?.userId || 'system', {
        targetId: id,
        orgId: r.tenant.orgId,
      });

      res.json({ message: 'API key revoked successfully' });
    } catch (err) {
      next(err);
    }
  };
}
