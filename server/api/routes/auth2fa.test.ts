import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';
import { migrate } from '../../infrastructure/db/migrate';
import {
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
  membershipRepository,
  twoFactorRepository,
  totpService,
} from '../../infrastructure/repositories/SharedUserRepository';
import { AuthService } from '../../domain/services/AuthService';

describe('2FA Security & Bypass Prevention', () => {
  let authService: AuthService;

  beforeEach(async () => {
    migrate(db);
    db.prepare('DELETE FROM user_two_factor').run();
    db.prepare('DELETE FROM memberships').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM organizations').run();

    authService = new AuthService(
      userRepository,
      orgRepository,
      billingRepository,
      tokenStore,
      undefined,
      membershipRepository,
      twoFactorRepository,
      totpService
    );
  });

  it('SECURITY REGRESSION: rejects pre-auth mfaToken on protected routes until verified with TOTP', async () => {
    // 1. Register a user
    const reg = await authService.register('Secure User', 'secure@example.com', 'SuperSecret123!');
    const initialToken = reg.tokens.access;

    // 2. Setup and enable 2FA
    const setup = await authService.setup2Fa(reg.user.id);
    const validCode = totpService.generateTotpCode(setup.secret);
    await authService.enable2Fa(reg.user.id, validCode);

    // 3. Login with correct password — must return mfaRequired and mfaToken
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'secure@example.com', password: 'SuperSecret123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.mfaRequired).toBe(true);
    expect(loginRes.body.mfaToken).toBeDefined();

    const mfaToken = loginRes.body.mfaToken;

    // 4. CRITICAL CHECK: Attempting to use the pre-auth mfaToken as Bearer token on protected routes MUST FAIL with 401
    const protectedRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${mfaToken}`);

    expect(protectedRes.status).toBe(401);

    const workspacesRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${mfaToken}`);

    expect(workspacesRes.status).toBe(401);

    // 5. Complete 2FA verification via /api/auth/2fa/verify
    const codeNow = totpService.generateTotpCode(setup.secret);
    const verifyRes = await request(app)
      .post('/api/auth/2fa/verify')
      .send({ mfaToken, code: codeNow });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.id).toBe(reg.user.id);

    // Extract access cookie or header from verify response
    const cookies = verifyRes.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies).toBeDefined();

    // 6. Accessing protected route with the real post-MFA session succeeds
    const authedRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies!);

    expect(authedRes.status).toBe(200);
    expect(authedRes.body.email).toBe('secure@example.com');
  });
});
