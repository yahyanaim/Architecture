import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';
import { migrate } from '../../infrastructure/db/migrate';
import { AuthService } from '../../domain/services/AuthService';
import {
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
} from '../../infrastructure/repositories/SharedUserRepository';

describe('CSRF Double-Submit Middleware', () => {
  beforeAll(() => {
    migrate(db);
  });

  const authService = new AuthService(userRepository, orgRepository, billingRepository, tokenStore);
  let sessionCookies: string[] = [];
  let userEmail: string;

  beforeEach(async () => {
    userEmail = `csrf-test-${Date.now()}@example.com`;
    const reg = await authService.register('CSRF User', userEmail, 'StrongPass123!');
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password: 'StrongPass123!' });

    sessionCookies = loginRes.headers['set-cookie'] as string[];
  });

  it('provisions csrf_token and XSRF-TOKEN cookies on safe GET requests', async () => {
    const res = await request(app).get('/api/v1/auth/csrf');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeDefined();

    const setCookie = res.headers['set-cookie'] as string[];
    expect(setCookie).toBeDefined();
    expect(setCookie.some((c) => c.includes('csrf_token='))).toBe(true);
    expect(setCookie.some((c) => c.includes('XSRF-TOKEN='))).toBe(true);
  });

  it('rejects cookie-authenticated POST request when X-CSRF-Token is missing (403)', async () => {
    // Session cookie is present, but no x-csrf-token header is provided
    const res = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', sessionCookies)
      .send({ name: 'Malicious Org' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });

  it('rejects cookie-authenticated POST request when X-CSRF-Token mismatches cookie (403)', async () => {
    const res = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', sessionCookies)
      .set('X-CSRF-Token', 'completely_wrong_token')
      .send({ name: 'Malicious Org' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });

  it('allows cookie-authenticated POST request when X-CSRF-Token matches csrf_token cookie', async () => {
    // Extract real csrf_token cookie set during login
    let csrfToken = '';
    for (const c of sessionCookies) {
      const match = c.match(/csrf_token=([^;]+)/);
      if (match) {
        csrfToken = match[1];
        break;
      }
    }

    expect(csrfToken).toBeTruthy();

    const res = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', sessionCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Valid Workspace Name' });

    // It passes CSRF check (can be 200/201 or domain response, not 403 CSRF_INVALID)
    expect(res.status).not.toBe(403);
  });

  it('exempts pure Bearer token authenticated requests from requiring CSRF header', async () => {
    const loginRes = await authService.login(userEmail, 'StrongPass123!');
    const token = loginRes.tokens.access;

    const res = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bearer Token Workspace' });

    expect(res.status).not.toBe(403);
  });
});
