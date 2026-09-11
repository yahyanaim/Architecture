import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';
import { migrate } from '../../infrastructure/db/migrate';
import { userRepository, orgRepository, billingRepository, tokenStore, membershipRepository, apiKeyRepository } from '../../infrastructure/repositories/SharedUserRepository';
import { AuthService } from '../../domain/services/AuthService';
import { ApiKeyService } from '../../domain/services/ApiKeyService';
import { createAuthenticateApiKey } from '../middleware/authenticateApiKey';
import express from 'express';

describe('Scoped Developer API Keys', () => {
  let authService: AuthService;
  let apiKeyService: ApiKeyService;
  let userToken: string;
  let userOrgId: string;

  beforeEach(async () => {
    migrate(db);
    db.prepare('DELETE FROM api_keys').run();
    db.prepare('DELETE FROM memberships').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM organizations').run();

    authService = new AuthService(
      userRepository,
      orgRepository,
      billingRepository,
      tokenStore,
      undefined,
      membershipRepository
    );
    apiKeyService = new ApiKeyService(apiKeyRepository);

    const reg = await authService.register('Dev User', 'dev@example.com', 'Password123!');
    userToken = reg.tokens.access;
    userOrgId = reg.org.id;
  });

  it('allows creating, listing, and revoking API keys for the workspace', async () => {
    // 1. Create API key
    const createRes = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'CI/CD Pipeline',
        scopes: ['read:users', 'write:users'],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('CI/CD Pipeline');
    expect(createRes.body.rawKey).toMatch(/^sk_live_/);
    expect(createRes.body.keyPrefix).toBeDefined();
    expect(createRes.body.scopes).toEqual(['read:users', 'write:users']);

    const rawKey = createRes.body.rawKey;
    const keyId = createRes.body.id;

    // 2. List API keys: rawKey is NOT revealed in listing
    const listRes = await request(app)
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${userToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(keyId);
    expect(listRes.body[0].rawKey).toBeUndefined();
    expect(listRes.body[0].keyPrefix).toBeDefined();

    // 3. Test authenticateApiKey middleware with rawKey
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/test-protected', createAuthenticateApiKey(apiKeyService, 'read:users'), (req: any, res) => {
      res.json({ orgId: req.tenant.orgId, keyId: req.apiKey.id });
    });

    const authedRes = await request(testApp)
      .get('/test-protected')
      .set('Authorization', `Bearer ${rawKey}`);

    expect(authedRes.status).toBe(200);
    expect(authedRes.body.orgId).toBe(userOrgId);

    // 4. Test insufficient scope rejection
    const testAppRestricted = express();
    testAppRestricted.use(express.json());
    testAppRestricted.get('/admin-only', createAuthenticateApiKey(apiKeyService, 'admin:billing'), (req, res) => {
      res.json({ ok: true });
    });

    const forbiddenRes = await request(testAppRestricted)
      .get('/admin-only')
      .set('Authorization', `Bearer ${rawKey}`);

    expect(forbiddenRes.status).toBe(403);

    // 5. Revoke key
    const revokeRes = await request(app)
      .delete(`/api/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(revokeRes.status).toBe(200);

    // Subsequent call with revoked key fails
    const postRevokeRes = await request(testApp)
      .get('/test-protected')
      .set('Authorization', `Bearer ${rawKey}`);

    expect(postRevokeRes.status).toBe(401);
  });
});
