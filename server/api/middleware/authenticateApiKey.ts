import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../../domain/services/ApiKeyService';
import { ApiKey } from '../../domain/entities/ApiKey';

export interface ApiKeyRequest extends Request {
  apiKey?: ApiKey;
  tenant?: { orgId: string };
  user?: { userId: string; email?: string; role?: string; orgId: string };
}

export function createAuthenticateApiKey(apiKeyService: ApiKeyService, requiredScope?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.header('authorization') || req.header('x-api-key');
      if (!header) {
        res.status(401).json({ message: 'API key required' });
        return;
      }

      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
      const apiKey = await apiKeyService.verifyApiKey(token);
      if (!apiKey) {
        res.status(401).json({ message: 'Invalid or expired API key' });
        return;
      }

      if (requiredScope && !apiKey.hasScope(requiredScope)) {
        res.status(403).json({ message: `Insufficient permissions: scope '${requiredScope}' required` });
        return;
      }

      const r = req as ApiKeyRequest;
      r.apiKey = apiKey;
      r.tenant = { orgId: apiKey.orgId };
      r.user = { userId: apiKey.userId, orgId: apiKey.orgId };
      next();
    } catch (err) {
      next(err);
    }
  };
}
