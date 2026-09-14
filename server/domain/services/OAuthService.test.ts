import { describe, it, expect, beforeEach } from 'vitest';
import { OAuthService } from './OAuthService';
import { AuthService } from './AuthService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import {
  IOrganizationRepository,
  ISubscriptionRepository,
  ITokenStore,
  RefreshSession,
  AuthToken,
} from '../interfaces/ITenant';
import { IMembershipRepository, UserWorkspace } from '../interfaces/IMembershipRepository';
import { IOAuthAccountRepository } from '../interfaces/IOAuthAccountRepository';
import { ITwoFactorRepository } from '../interfaces/ITwoFactorRepository';
import { Organization } from '../entities/Organization';
import { Subscription, Plan, SubscriptionStatus } from '../entities/Subscription';
import { Membership, MembershipRole } from '../entities/Membership';
import { OAuthAccount } from '../entities/OAuthAccount';
import { TwoFactorAuth } from '../entities/TwoFactorAuth';
import { JwtTokenService } from '../../infrastructure/security/JwtTokenService';
import { IOAuthProviderClient, OAuthProfile } from '../../infrastructure/oauth/OAuthProviderClient';
import { BusinessException } from '../exceptions/BusinessException';
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
  async findByProviderRef(ref: string) {
    for (const s of this.map.values()) if (s.providerRef === ref) return s;
    return null;
  }
  async save(s: Subscription) { this.map.set(s.orgId, s); }
  async recordWebhookEvent() { return true; }
  async updatePlan(orgId: string, plan: Plan, status: SubscriptionStatus) {
    const s = this.map.get(orgId) ?? new Subscription(orgId);
    s.plan = plan;
    s.status = status;
    this.map.set(orgId, s);
    return s;
  }
}

class MemTokens implements ITokenStore {
  refresh: RefreshSession[] = [];
  auth: AuthToken[] = [];

  async createRefresh(input: { userId: string; tokenHash: string; expiresAt: Date; ip?: string }) {
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
  async revokeRefresh(id: string, replacedBy?: string | null) {
    const r = this.refresh.find((x) => x.id === id);
    if (r) { r.revokedAt = new Date(); r.replacedBy = replacedBy ?? null; }
  }
  async revokeAllForUser(userId: string): Promise<number> {
    let count = 0;
    for (const r of this.refresh) {
      if (r.userId === userId && !r.revokedAt) {
        r.revokedAt = new Date();
        count++;
      }
    }
    return count;
  }
  async deleteExpiredRefresh(_before?: Date): Promise<number> {
    return 0;
  }
  async createAuthToken(input: { userId: string | null; type: any; tokenHash: string; expiresAt: Date; meta?: any }): Promise<AuthToken> {
    const t: AuthToken = {
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      meta: input.meta ?? {},
      createdAt: new Date(),
      usedAt: null,
    };
    this.auth.push(t);
    return t;
  }
  async consumeAuthToken(tokenHash: string, type: any): Promise<AuthToken | null> {
    const t = this.auth.find((x) => x.tokenHash === tokenHash && x.type === type && !x.usedAt);
    if (!t) return null;
    t.usedAt = new Date();
    return t;
  }
}

class MemMemberships implements IMembershipRepository {
  map = new Map<string, Membership>();
  async save(m: Membership) { this.map.set(m.id, m); }
  async findByUserAndOrg(userId: string, orgId: string) {
    for (const m of this.map.values()) if (m.userId === userId && m.orgId === orgId) return m;
    return null;
  }
  async findAllByUser(userId: string): Promise<UserWorkspace[]> {
    const res: UserWorkspace[] = [];
    for (const m of this.map.values()) {
      if (m.userId === userId) {
        res.push({
          organization: new Organization(m.orgId, 'Workspace', 'workspace'),
          membership: m,
        });
      }
    }
    return res;
  }
  async findAllByOrg(orgId: string): Promise<Membership[]> {
    return Array.from(this.map.values()).filter((m) => m.orgId === orgId);
  }
  async countAdminsByOrg(orgId: string): Promise<number> {
    return Array.from(this.map.values()).filter((m) => m.orgId === orgId && m.role === 'admin').length || 1;
  }
  async countByOrg(orgId: string): Promise<number> {
    return Array.from(this.map.values()).filter((m) => m.orgId === orgId).length;
  }
  async updateRole(userId: string, orgId: string, role: MembershipRole): Promise<void> {
    const m = await this.findByUserAndOrg(userId, orgId);
    if (m) m.role = role;
  }
  async delete(userId: string, orgId: string): Promise<void> {
    for (const [k, v] of this.map.entries()) {
      if (v.userId === userId && v.orgId === orgId) this.map.delete(k);
    }
  }
}

class MemOAuthRepo implements IOAuthAccountRepository {
  accounts: OAuthAccount[] = [];
  async findByProviderAndSub(provider: string, providerSub: string) {
    return this.accounts.find((a) => a.provider === provider && a.providerSub === providerSub) ?? null;
  }
  async findByUserId(userId: string) {
    return this.accounts.filter((a) => a.userId === userId);
  }
  async save(account: OAuthAccount) {
    const idx = this.accounts.findIndex(
      (a) => a.provider === account.provider && a.providerSub === account.providerSub
    );
    if (idx >= 0) this.accounts[idx] = account;
    else this.accounts.push(account);
  }
  async delete(id: string) {
    this.accounts = this.accounts.filter((a) => a.id !== id);
  }
}

class MemTwoFactorRepo implements ITwoFactorRepository {
  map = new Map<string, TwoFactorAuth>();
  async findByUserId(userId: string) { return this.map.get(userId) ?? null; }
  async save(record: TwoFactorAuth) { this.map.set(record.userId, record); }
  async delete(userId: string) { this.map.delete(userId); }
}

class MockOAuthProviderClient implements IOAuthProviderClient {
  mockProfiles = new Map<string, OAuthProfile>();
  async exchangeCode(provider: string, code: string): Promise<OAuthProfile> {
    const profile = this.mockProfiles.get(code);
    if (!profile) throw new Error(`Unknown mock authorization code: ${code}`);
    return profile;
  }
}

describe('OAuthService (OIDC Google & GitHub SSO)', () => {
  let userRepo: InMemoryUserRepository;
  let orgRepo: MemOrgs;
  let subRepo: MemSubs;
  let tokenStore: MemTokens;
  let membershipRepo: MemMemberships;
  let oauthRepo: MemOAuthRepo;
  let twoFactorRepo: MemTwoFactorRepo;
  let tokenService: JwtTokenService;
  let authService: AuthService;
  let providerClient: MockOAuthProviderClient;
  let oauthService: OAuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    orgRepo = new MemOrgs();
    subRepo = new MemSubs();
    tokenStore = new MemTokens();
    membershipRepo = new MemMemberships();
    oauthRepo = new MemOAuthRepo();
    twoFactorRepo = new MemTwoFactorRepo();
    tokenService = new JwtTokenService('test-secret-key-12345678901234567890');
    authService = new AuthService(
      userRepo,
      orgRepo,
      subRepo,
      tokenStore,
      tokenService,
      membershipRepo,
      twoFactorRepo
    );
    providerClient = new MockOAuthProviderClient();
    oauthService = new OAuthService(
      userRepo,
      orgRepo,
      subRepo,
      membershipRepo,
      oauthRepo,
      authService,
      providerClient,
      twoFactorRepo,
      tokenService,
      {
        appUrl: 'http://localhost:40001',
        googleClientId: 'google-id',
        githubClientId: 'github-id',
      }
    );
  });

  it('generates provider authorization URLs with state CSRF nonce', () => {
    const state = 'nonce-12345';
    const googleUrl = oauthService.getAuthorizationUrl('google', state);
    expect(googleUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(googleUrl).toContain('client_id=google-id');
    expect(googleUrl).toContain('state=nonce-12345');

    const githubUrl = oauthService.getAuthorizationUrl('github', state);
    expect(githubUrl).toContain('https://github.com/login/oauth/authorize');
    expect(githubUrl).toContain('client_id=github-id');
    expect(githubUrl).toContain('state=nonce-12345');
  });

  it('Test 1: bootstraps new user via OAuth, awarding admin role to the first user', async () => {
    const profile: OAuthProfile = {
      provider: 'google',
      providerSub: 'google-sub-101',
      email: 'first.founder@saas.com',
      name: 'First Founder',
      emailVerified: true,
    };

    const result = await oauthService.authenticateWithProfile(profile);

    expect(result.mfaRequired).toBeFalsy();
    if (!result.mfaRequired) {
      expect(result.user.email).toBe('first.founder@saas.com');
      expect(result.user.role).toBe('admin'); // First-user-admin rule!
      expect(result.user.isVerified).toBe(true);
      expect(result.org.name).toBe("First Founder's workspace");
      expect(result.tokens.access).toBeDefined();
      expect(result.tokens.refresh).toBeDefined();

      const savedOAuth = await oauthRepo.findByProviderAndSub('google', 'google-sub-101');
      expect(savedOAuth).not.toBeNull();
      expect(savedOAuth?.userId).toBe(result.user.id);
    }
  });

  it('Test 2: registers second new user with regular "user" role and personal workspace', async () => {
    // 1. First user registers
    await oauthService.authenticateWithProfile({
      provider: 'google',
      providerSub: 'google-sub-1',
      email: 'admin@saas.com',
      name: 'Admin',
      emailVerified: true,
    });

    // 2. Second user registers via GitHub
    const secondResult = await oauthService.authenticateWithProfile({
      provider: 'github',
      providerSub: 'github-sub-2',
      email: 'developer@saas.com',
      name: 'Dev Bob',
      emailVerified: true,
    });

    expect(secondResult.mfaRequired).toBeFalsy();
    if (!secondResult.mfaRequired) {
      expect(secondResult.user.role).toBe('user'); // Second user is 'user'!
      expect(secondResult.org.name).toBe("Dev Bob's workspace");
    }
  });

  it('Test 3: links OAuth to existing password user matching verified email', async () => {
    // 1. Create user with password
    const reg = await authService.register('Existing Alice', 'alice@company.com', 'Password123!');
    const originalOrgId = reg.org.id;

    // 2. Alice authenticates via Google with same email
    const oauthResult = await oauthService.authenticateWithProfile({
      provider: 'google',
      providerSub: 'google-sub-alice',
      email: 'alice@company.com',
      name: 'Alice Google',
      emailVerified: true,
    });

    expect(oauthResult.mfaRequired).toBeFalsy();
    if (!oauthResult.mfaRequired) {
      expect(oauthResult.user.id).toBe(reg.user.id);
      expect(oauthResult.org.id).toBe(originalOrgId); // Preserved existing workspace!
      expect(oauthResult.isNewUser).toBe(false);

      const link = await oauthRepo.findByProviderAndSub('google', 'google-sub-alice');
      expect(link?.userId).toBe(reg.user.id);
    }
  });

  it('Test 4: enforces 2FA challenge when user has 2FA enabled', async () => {
    // 1. Bootstrap user
    const res = await oauthService.authenticateWithProfile({
      provider: 'google',
      providerSub: 'google-sub-2fa',
      email: 'mfa.user@company.com',
      name: 'MFA User',
      emailVerified: true,
    });

    if (res.mfaRequired) throw new Error('Expected initial login without 2FA');

    // 2. Enable 2FA on the user account
    const twoFactor = TwoFactorAuth.create(res.user.id, 'JBSWY3DPEHPK3PXP', ['hash1']);
    twoFactor.isEnabled = true;
    await twoFactorRepo.save(twoFactor);

    // 3. User attempts subsequent OAuth login
    const mfaLogin = await oauthService.authenticateWithProfile({
      provider: 'google',
      providerSub: 'google-sub-2fa',
      email: 'mfa.user@company.com',
      name: 'MFA User',
      emailVerified: true,
    });

    expect(mfaLogin.mfaRequired).toBe(true);
    if (mfaLogin.mfaRequired) {
      expect(mfaLogin.mfaToken).toBeDefined();
      const payload = tokenService.verifyAccessToken(mfaLogin.mfaToken);
      expect(payload.purpose).toBe('mfa');
      expect(payload.userId).toBe(res.user.id);
    }
  });

  it('Test 5: rejects unverified email from untrusted provider', async () => {
    await expect(
      oauthService.authenticateWithProfile({
        provider: 'google',
        providerSub: 'unverified-sub',
        email: 'unverified@attacker.com',
        name: 'Attacker',
        emailVerified: false,
      })
    ).rejects.toThrow(BusinessException);
  });

  it('Test 6: supports callback handling via provider client exchange', async () => {
    providerClient.mockProfiles.set('auth-code-999', {
      provider: 'github',
      providerSub: 'gh-999',
      email: 'gituser@code.com',
      name: 'GitUser',
      emailVerified: true,
    });

    const result = await oauthService.handleCallback('github', 'auth-code-999');
    expect(result.mfaRequired).toBeFalsy();
    if (!result.mfaRequired) {
      expect(result.user.email).toBe('gituser@code.com');
    }
  });
});
