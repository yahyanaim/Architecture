import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';
import { migrate } from '../../infrastructure/db/migrate';

describe('OAuth API Routes (/api/auth/oauth)', () => {
  beforeAll(() => {
    migrate(db);
  });
  it('GET /api/auth/oauth/:provider/url returns authorization URL and sets state cookie for google', async () => {
    const res = await request(app).get('/api/auth/oauth/google/url');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(res.body.url).toContain('response_type=code');

    const cookieHeader = res.headers['set-cookie'];
    const cookieList = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [cookieHeader] : [];
    expect(cookieList.some((c: string) => c.startsWith('oauth_state='))).toBe(true);
  });

  it('GET /api/auth/oauth/:provider/url returns authorization URL and sets state cookie for github', async () => {
    const res = await request(app).get('/api/auth/oauth/github/url');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://github.com/login/oauth/authorize');

    const cookieHeader = res.headers['set-cookie'];
    const cookieList = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [cookieHeader] : [];
    expect(cookieList.some((c: string) => c.startsWith('oauth_state='))).toBe(true);
  });

  it('GET /api/auth/oauth/:provider/url returns 400 for unsupported provider', async () => {
    const res = await request(app).get('/api/auth/oauth/twitter/url');
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Unsupported provider');
  });

  it('GET /api/auth/oauth/callback rejects mismatched CSRF state', async () => {
    const res = await request(app)
      .get('/api/auth/oauth/google/callback?code=mock_code&state=fake_state')
      .set('Cookie', ['oauth_state=real_state']);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invalid OAuth state');
  });

  it('GET /api/auth/oauth/callback rejects missing authorization code', async () => {
    const res = await request(app)
      .get('/api/auth/oauth/google/callback?state=my_state')
      .set('Cookie', ['oauth_state=my_state']);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Missing OAuth authorization code');
  });

  it('GET /api/auth/oauth/:provider/url?redirect=true redirects to Google OAuth authorization endpoint', async () => {
    const res = await request(app).get('/api/auth/oauth/google/url?redirect=true');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('GET /api/auth/oauth/callback with valid state completes login and sets session cookies', async () => {
    const res = await request(app)
      .get('/api/auth/oauth/google/callback?code=dev_mock_google&state=valid_state')
      .set('Cookie', ['oauth_state=valid_state']);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');

    const cookies = res.headers['set-cookie'];
    const cookieList = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
    expect(cookieList.some((c: string) => c.startsWith('access='))).toBe(true);
    expect(cookieList.some((c: string) => c.startsWith('refresh='))).toBe(true);
  });
});
