import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './AuthService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import {
  IOrganizationRepository,
  ISubscriptionRepository,
  ITokenStore,
  RefreshSession,
  AuthToken,
  AuthTokenType,
} from '../../domain/interfaces/ITenant';
import { ITwoFactorRepository } from '../interfaces/ITwoFactorRepository';
import { TwoFactorAuth } from '../entities/TwoFactorAuth';
import { TotpService } from '../../infrastructure/security/TotpService';
import { Organization } from '../../domain/entities/Organization';
import { Subscription } from '../../domain/entities/Subscription';
import crypto from 'crypto';

class MemOrgs implements IOrganizationRepository {
  map = new Map<string, Organization>();
  async findById(id: string) { return this.map.get(id) ?? null; }
  async findBySlug(slug: string) {
    for (const o of this.map.values()) if (o.slug === slug) return o;
    return null;
  }
  async save(o: Organization) { this.map.set(o.id, o); }
}

class MemSubs implements ISubscriptionRepository {
  map = new Map<string, Subscription>();
  async findByOrgId(orgId: string) { return this.map.get(orgId) ?? null; }
  async findByProviderRef(ref: string) { return null; }
  async save(s: Subscription) { this.map.set(s.orgId, s); }
  async recordWebhookEvent() { return true; }
  async updatePlan(orgId: string) { return new Subscription(orgId); }
}

class MemTokens implements ITokenStore {
  refresh: RefreshSession[] = [];
  auth: AuthToken[] = [];
  async createRefresh(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    const r: RefreshSession = {
      id: crypto.randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedBy: null,
      createdAt: new Date(),
    };
    this.refresh.push(r);
    return r;
  }
  async findRefreshByHash(h: string) { return this.refresh.find((r) => r.tokenHash === h) ?? null; }
  async revokeRefresh(id: string) {}
  async revokeAllForUser(userId: string) { return 0; }
  async deleteExpiredRefresh() { return 0; }
  async createAuthToken(input: any) {
    const t: AuthToken = {
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: new Date(),
      meta: {},
    };
    this.auth.push(t);
    return t;
  }
  async consumeAuthToken() { return null; }
}

class MemTwoFactor implements ITwoFactorRepository {
  map = new Map<string, TwoFactorAuth>();
  async findByUserId(userId: string) { return this.map.get(userId) ?? null; }
  async save(tf: TwoFactorAuth) { this.map.set(tf.userId, tf); }
  async delete(userId: string) { this.map.delete(userId); }
}

describe('AuthService Two-Factor Authentication (2FA)', () => {
  let authService: AuthService;
  let userRepo: InMemoryUserRepository;
  let twoFactorRepo: MemTwoFactor;
  let totpService: TotpService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    twoFactorRepo = new MemTwoFactor();
    totpService = new TotpService();
    authService = new AuthService(
      userRepo,
      new MemOrgs(),
      new MemSubs(),
      new MemTokens(),
      'test-secret-at-least-32-chars-long-here',
      undefined,
      twoFactorRepo,
      totpService
    );
  });

  it('completes the full 2FA lifecycle: setup, enable, login with MFA challenge, and verify', async () => {
    // 1. Register a user
    const { user } = await authService.register('Alice', 'alice@example.com', 'Password123!');

    // 2. Setup 2FA
    const setup = await authService.setup2Fa(user.id);
    expect(setup.secret).toBeDefined();
    expect(setup.uri).toContain('otpauth://totp/');
    expect(setup.recoveryCodes.length).toBe(8);

    // Initial state: not yet enabled
    const record = await twoFactorRepo.findByUserId(user.id);
    expect(record?.isEnabled).toBe(false);

    // 3. Enable 2FA with valid TOTP code
    const validCode = totpService.generateTotpCode(setup.secret);
    await authService.enable2Fa(user.id, validCode);
    expect(record?.isEnabled).toBe(true);

    // 4. Login: should now require 2FA challenge instead of issuing tokens directly
    const loginRes = await authService.login('alice@example.com', 'Password123!');
    expect(loginRes.mfaRequired).toBe(true);
    if (!loginRes.mfaRequired) throw new Error('Expected MFA');
    expect(loginRes.mfaToken).toBeDefined();

    // 5. Complete 2FA verification with TOTP code
    const codeNow = totpService.generateTotpCode(setup.secret);
    const mfaVerifyRes = await authService.verify2Fa(loginRes.mfaToken, codeNow);
    expect(mfaVerifyRes.user.id).toBe(user.id);
    expect(mfaVerifyRes.tokens.access).toBeDefined();
    expect(mfaVerifyRes.tokens.refresh).toBeDefined();
  });

  it('allows fallback recovery code authentication and consumes the code', async () => {
    const { user } = await authService.register('Bob', 'bob@example.com', 'Password123!');
    const setup = await authService.setup2Fa(user.id);
    const validCode = totpService.generateTotpCode(setup.secret);
    await authService.enable2Fa(user.id, validCode);

    const loginRes = await authService.login('bob@example.com', 'Password123!');
    expect(loginRes.mfaRequired).toBe(true);
    if (!loginRes.mfaRequired) throw new Error('Expected MFA');

    // Use a recovery code instead of TOTP
    const backupCode = setup.recoveryCodes[0]!;
    const mfaVerifyRes = await authService.verify2Fa(loginRes.mfaToken, backupCode);
    expect(mfaVerifyRes.user.id).toBe(user.id);
    expect(mfaVerifyRes.tokens.access).toBeDefined();

    // Reusing the same recovery code must fail
    await expect(authService.verify2Fa(loginRes.mfaToken, backupCode)).rejects.toThrow();
  });

  it('allows user to disable 2FA with valid password and TOTP code', async () => {
    const { user } = await authService.register('Charlie', 'charlie@example.com', 'Password123!');
    const setup = await authService.setup2Fa(user.id);
    const validCode = totpService.generateTotpCode(setup.secret);
    await authService.enable2Fa(user.id, validCode);

    const code = totpService.generateTotpCode(setup.secret);
    await authService.disable2Fa(user.id, 'Password123!', code);

    const record = await twoFactorRepo.findByUserId(user.id);
    expect(record).toBeNull();

    // Subsequent login goes straight through without 2FA
    const loginRes = await authService.login('charlie@example.com', 'Password123!');
    expect(loginRes.mfaRequired).toBeUndefined();
    expect(loginRes.tokens?.access).toBeDefined();
  });
});
