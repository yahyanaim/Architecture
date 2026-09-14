import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';
import { migrate } from '../../infrastructure/db/migrate';

describe('Passkey API Routes (/api/auth/passkey)', () => {
  beforeAll(() => {
    migrate(db);
  });
  it('GET /api/auth/passkey/login/options returns challenge and sets cookie', async () => {
    const res = await request(app).get('/api/auth/passkey/login/options');
    expect(res.status).toBe(200);
    expect(res.body.challenge).toBeTruthy();
    expect(res.body.rpId).toBeTruthy();

    const cookieHeader = res.headers['set-cookie'];
    const cookieList = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [cookieHeader] : [];
    expect(cookieList.some((c: string) => c.startsWith('passkey_auth_challenge='))).toBe(true);
  });

  it('POST /api/auth/passkey/login/options returns challenge with email filter', async () => {
    const res = await request(app).post('/api/auth/passkey/login/options?email=user@example.com');
    expect(res.status).toBe(200);
    expect(res.body.challenge).toBeTruthy();
  });

  it('POST /api/auth/passkey/login/verify rejects missing challenge cookie', async () => {
    const res = await request(app)
      .post('/api/auth/passkey/login/verify')
      .send({ response: { id: 'test' } });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Missing or expired passkey authentication challenge');
  });

  it('POST /api/auth/passkey/login/verify rejects missing assertion response payload', async () => {
    const res = await request(app)
      .post('/api/auth/passkey/login/verify')
      .set('Cookie', ['passkey_auth_challenge=mock_challenge'])
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Missing passkey authentication response');
  });

  it('POST /api/auth/passkey/register/options requires active user authentication', async () => {
    const res = await request(app).post('/api/auth/passkey/register/options');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/passkey/credentials requires active user authentication', async () => {
    const res = await request(app).get('/api/auth/passkey/credentials');
    expect(res.status).toBe(401);
  });
});
