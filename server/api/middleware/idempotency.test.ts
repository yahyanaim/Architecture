import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app } from '../../app';
import { migrate } from '../../infrastructure/db/migrate';
import { db } from '../../infrastructure/database';
import { idempotency } from './idempotency';

import { AuthService } from '../../domain/services/AuthService';
import {
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
  membershipRepository,
} from '../../infrastructure/repositories/SharedUserRepository';

describe('API Hardening: Idempotency & v1 Routing & Pagination', () => {
  beforeAll(() => {
    migrate(db);
  });

  describe('Idempotency Middleware unit behavior', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(idempotency);

    let invocationCount = 0;
    testApp.post('/test-idempotent', (req, res) => {
      invocationCount++;
      res.status(201).json({ count: invocationCount, echo: req.body });
    });

    it('ignores GET requests', async () => {
      const res = await request(testApp)
        .get('/test-idempotent')
        .set('Idempotency-Key', 'key-get');
      expect(res.status).toBe(404);
    });

    it('passes through POST when no Idempotency-Key header is present', async () => {
      const res1 = await request(testApp)
        .post('/test-idempotent')
        .send({ foo: 'bar' });
      expect(res1.status).toBe(201);
      expect(res1.headers['idempotency-replayed']).toBeUndefined();

      const res2 = await request(testApp)
        .post('/test-idempotent')
        .send({ foo: 'bar' });
      expect(res2.status).toBe(201);
      expect(res2.body.count).toBe(res1.body.count + 1);
    });

    it('rejects Idempotency-Key longer than 255 characters', async () => {
      const longKey = 'a'.repeat(256);
      const res = await request(testApp)
        .post('/test-idempotent')
        .set('Idempotency-Key', longKey)
        .send({ foo: 'bar' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid Idempotency-Key');
    });

    it('replays response when duplicate POST with identical payload is sent', async () => {
      const key = `test-key-${Date.now()}`;
      const payload = { action: 'create-resource', amount: 100 };

      // First request
      const res1 = await request(testApp)
        .post('/test-idempotent')
        .set('Idempotency-Key', key)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.headers['idempotency-replayed']).toBeUndefined();
      const firstBody = res1.body;

      // Duplicate request
      const res2 = await request(testApp)
        .post('/test-idempotent')
        .set('Idempotency-Key', key)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.headers['idempotency-replayed']).toBe('true');
      expect(res2.headers['idempotency-key']).toBe(key);
      expect(res2.body).toEqual(firstBody);
      // Handler was not invoked a second time
      expect(res2.body.count).toBe(firstBody.count);
    });

    it('rejects with 422 IDEMPOTENCY_CONFLICT when key is reused with different payload', async () => {
      const key = `test-conflict-${Date.now()}`;

      // First request with payload A
      const res1 = await request(testApp)
        .post('/test-idempotent')
        .set('Idempotency-Key', key)
        .send({ role: 'editor' });
      expect(res1.status).toBe(201);

      // Second request with payload B
      const res2 = await request(testApp)
        .post('/test-idempotent')
        .set('Idempotency-Key', key)
        .send({ role: 'admin' });

      expect(res2.status).toBe(422);
      expect(res2.body.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  describe('/api/v1 routing and legacy /api deprecation shim', () => {
    it('GET /api/v1/health returns 200 without Deprecation header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.headers['deprecation']).toBeUndefined();
    });

    it('GET /api/health returns 200 WITH Deprecation and Warning headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.headers['deprecation']).toBe('true');
      expect(res.headers['warning']).toContain('299');
    });

    it('GET /api/v1/health/live returns 200 alive', async () => {
      const res = await request(app).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
    });

    it('GET /api/v1/health/ready returns 200 ready', async () => {
      const res = await request(app).get('/api/v1/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });
  });

  describe('End-to-End: v1 pagination and route-level idempotency', () => {
    let adminToken: string;

    beforeAll(async () => {
      const authService = new AuthService(
        userRepository,
        orgRepository,
        billingRepository,
        tokenStore,
        undefined,
        membershipRepository
      );
      const reg = await authService.register('Super Admin', `admin-${Date.now()}@example.com`, 'AdminPassword123!');
      adminToken = reg.tokens.access;
    });

    it('POST /api/v1/api-keys with Idempotency-Key returns cached response on duplicate', async () => {
      const key = `idem-apikey-${Date.now()}`;
      const payload = { name: 'CI/CD Key', scopes: ['read', 'write'] };

      const res1 = await request(app)
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', key)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.name).toBe('CI/CD Key');
      const keyId = res1.body.id;

      // Duplicate request with same idempotency key
      const res2 = await request(app)
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', key)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.headers['idempotency-replayed']).toBe('true');
      expect(res2.body.id).toBe(keyId);
      expect(res2.body.rawKey).toBe(res1.body.rawKey);
    });

    it('GET /api/v1/users returns paginated object with metadata & headers', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.headers).toHaveProperty('x-has-more');
    });

    it('GET /api/users legacy route returns plain array with deprecation header', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.headers['deprecation']).toBe('true');
      expect(res.headers['warning']).toContain('299');
    });

    it('GET /api/v1/api-keys returns paginated object', async () => {
      const res = await request(app)
        .get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('GET /api/api-keys legacy returns plain array with deprecation header', async () => {
      const res = await request(app)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.headers['deprecation']).toBe('true');
    });

    it('GET /api/v1/admin/audit-logs supports limit and cursor pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBeLessThanOrEqual(1);
      expect(res.body.limit).toBe(1);
      expect(res.body).toHaveProperty('pagination');
      expect(res.headers).toHaveProperty('x-has-more');
    });
  });
});
