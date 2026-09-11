import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './AuthService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import {
  IOrganizationRepository, ISubscriptionRepository, ITokenStore,
  RefreshSession, AuthToken, AuthTokenType,
} from '../../domain/interfaces/ITenant';
import { Organization } from '../../domain/entities/Organization';
import { Subscription, Plan, SubscriptionStatus } from '../../domain/entities/Subscription';
import crypto from 'crypto';

// Test doubles for the new ports (orgs, subscriptions, tokens). Kept here —
// not shipped — because only tests need non-SQL implementations.
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
  seenEvents = new Set<string>();
  async findByOrgId(orgId: string) { return this.map.get(orgId) ?? null; }
  async findByProviderRef(ref: string) {
    for (const s of this.map.values()) if (s.providerRef === ref) return s;
    return null;
  }
  async save(s: Subscription) { this.map.set(s.orgId, s); }
  async recordWebhookEvent(eventId: string) {
    if (this.seenEvents.has(eventId)) return false;
    this.seenEvents.add(eventId);
    return true;
  }
  async updatePlan(orgId: string, plan: Plan, status: SubscriptionStatus) {
    const s = this.map.get(orgId) ?? new Subscription(orgId);
    s.plan = plan; s.status = status;
    this.map.set(orgId, s);
    return s;
  }
}

class MemTokens implements ITokenStore {
  refresh: RefreshSession[] = [];
  auth: (AuthToken & { used: boolean })[] = [];
  async createRefresh(input: { userId: string; tokenHash: string; expiresAt: Date; ip?: string }) {
    const r: RefreshSession = {
      id: crypto.randomUUID(), userId: input.userId, tokenHash: input.tokenHash,
      expiresAt: input.expiresAt, revokedAt: null, replacedBy: null, createdAt: new Date(),
    };
    this.refresh.push(r);
    return r;
  }
  async findRefreshByHash(h: string) { return this.refresh.find((r) => r.tokenHash === h) ?? null; }
  async revokeRefresh(id: string, replacedBy?: string | null) {
    const r = this.refresh.find((x) => x.id === id);
    if (r && !r.revokedAt) { r.revokedAt = new Date(); r.replacedBy = replacedBy ?? null; }
  }
  async revokeAllForUser(userId: string) {
    let n = 0;
    for (const r of this.refresh) {
      if (r.userId === userId && !r.revokedAt) { r.revokedAt = new Date(); n += 1; }
    }
    return n;
  }
  async deleteExpiredRefresh() { return 0; }
  async createAuthToken(input: { userId: string | null; type: AuthTokenType; tokenHash: string; expiresAt: Date; meta?: Record<string, unknown> }) {
    const t = {
      id: crypto.randomUUID(), userId: input.userId, type: input.type, tokenHash: input.tokenHash,
      expiresAt: input.expiresAt, usedAt: null as Date | null, createdAt: new Date(),
      meta: input.meta ?? {}, used: false,
    };
    this.auth.push(t);
    return t;
  }
  async consumeAuthToken(h: string, type: AuthTokenType) {
    const t = this.auth.find((x) => x.tokenHash === h && x.type === type);
    if (!t || t.used || t.expiresAt.getTime() < Date.now()) return null;
    t.used = true; t.usedAt = new Date();
    return t;
  }
}

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: InMemoryUserRepository;
  let orgs: MemOrgs;
  let subs: MemSubs;
  let tokens: MemTokens;
  const testSecret = 'test-secret-key-for-testing-only';

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    orgs = new MemOrgs();
    subs = new MemSubs();
    tokens = new MemTokens();
    authService = new AuthService(userRepository, orgs, subs, tokens, testSecret);
  });

  describe('register', () => {
    it('creates a new user with session tokens and a workspace', async () => {
      const result = await authService.register('John Doe', 'john@example.com', 'Password123');

      expect(result.user.name).toBe('John Doe');
      expect(result.user.email).toBe('john@example.com');
      expect(result.tokens.access).toBeDefined();
      expect(result.tokens.refresh).toBeDefined();
      expect(result.verifyToken).toBeDefined();
      expect(result.org.id).toBe(result.user.orgId);
      expect(await subs.findByOrgId(result.org.id)).not.toBeNull();
    });

    it('throws BusinessException if email already exists', async () => {
      await authService.register('John Doe', 'john@example.com', 'Password123');

      await expect(
        authService.register('Jane Doe', 'john@example.com', 'Password456')
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('login', () => {
    it('returns user, org and tokens on successful login', async () => {
      await authService.register('John Doe', 'john@example.com', 'Password123');

      const result = await authService.login('john@example.com', 'Password123');
      if (result.mfaRequired) throw new Error('Did not expect MFA');

      expect(result.user.email).toBe('john@example.com');
      expect(result.tokens.access).toBeDefined();
      expect(result.org.id).toBe(result.user.orgId);
    });

    it('throws BusinessException for invalid email', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'Password123')
      ).rejects.toThrow('Invalid email or password');
    });

    it('throws BusinessException for invalid password', async () => {
      await authService.register('John Doe', 'john@example.com', 'correctPassword1');

      await expect(
        authService.login('john@example.com', 'wrongPassword1')
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('verifyToken', () => {
    it('verifies a valid access token', async () => {
      const { tokens } = await authService.register('John Doe', 'john@example.com', 'Password123');

      const payload = authService.verifyToken(tokens.access);

      expect(payload.email).toBe('john@example.com');
    });

    it('throws BusinessException for invalid token', async () => {
      expect(() => authService.verifyToken('invalid-token')).toThrow('Invalid or expired token');
    });
  });

  describe('getUserById', () => {
    it('returns user by id', async () => {
      const { user } = await authService.register('John Doe', 'john@example.com', 'Password123');

      const found = await authService.getUserById(user.id);

      expect(found).not.toBeNull();
      expect(found?.email).toBe('john@example.com');
    });

    it('returns null for non-existent id', async () => {
      const found = await authService.getUserById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('role assignment', () => {
    it('assigns admin role to first user', async () => {
      const result = await authService.register('First User', 'first@example.com', 'Password123');
      expect(result.user.role).toBe('admin');
    });

    it('assigns user role to subsequent users', async () => {
      await authService.register('First User', 'first@example.com', 'Password123');

      const result = await authService.register('Second User', 'second@example.com', 'Password123');
      expect(result.user.role).toBe('user');
    });
  });

  describe('refresh rotation', () => {
    it('rotates the refresh token and revokes the old one', async () => {
      const reg = await authService.register('John Doe', 'john@example.com', 'Password123');
      const rotated = await authService.refreshSession(reg.tokens.refresh);

      expect(rotated.tokens.refresh).not.toBe(reg.tokens.refresh);
      // Old token is now revoked without replacement-link confusion: replay = theft.
      await expect(authService.refreshSession(reg.tokens.refresh)).rejects.toThrow(/compromised/);
    });

    it('revokes the whole chain on reuse (theft response)', async () => {
      const reg = await authService.register('John Doe', 'john@example.com', 'Password123');
      const rotated = await authService.refreshSession(reg.tokens.refresh);
      await expect(authService.refreshSession(reg.tokens.refresh)).rejects.toThrow();

      // Even the CURRENT valid token dies with the chain.
      await expect(authService.refreshSession(rotated.tokens.refresh)).rejects.toThrow();
    });
  });

  describe('email verification', () => {
    it('verifies with a valid token; rejects reuse', async () => {
      const reg = await authService.register('John Doe', 'john@example.com', 'Password123');
      expect(reg.user.isVerified).toBe(false);

      const user = await authService.verifyEmail(reg.verifyToken);
      expect(user.isVerified).toBe(true);
      await expect(authService.verifyEmail(reg.verifyToken)).rejects.toThrow();
    });
  });

  describe('password reset', () => {
    it('resets password and kills all sessions', async () => {
      const reg = await authService.register('John Doe', 'john@example.com', 'Password123');
      const token = await authService.requestPasswordReset('john@example.com');
      expect(token).toBeTruthy();

      await authService.resetPassword(token!, 'NewPassword1');
      // Old password dead, old session dead.
      await expect(authService.login('john@example.com', 'Password123')).rejects.toThrow();
      await expect(authService.refreshSession(reg.tokens.refresh)).rejects.toThrow();
      const ok = await authService.login('john@example.com', 'NewPassword1');
      if (ok.mfaRequired) throw new Error('Did not expect MFA');
      expect(ok.user.email).toBe('john@example.com');
    });

    it('returns null for unknown email (no enumeration)', async () => {
      expect(await authService.requestPasswordReset('ghost@example.com')).toBeNull();
    });
  });

  describe('invites', () => {
    it('invited user sets password and auto-verifies on accept', async () => {
      const reg = await authService.register('Owner', 'owner@example.com', 'Password123');
      const owner = reg.user;
      const { user, inviteToken } = await authService.createInvite('New Hire', 'hire@example.com', owner.orgId);
      expect(user.orgId).toBe(owner.orgId);
      expect(user.isVerified).toBe(false);

      const accepted = await authService.acceptInvite(inviteToken, 'HirePass1', 'New Hire');
      expect(accepted.user.isVerified).toBe(true);
      expect(accepted.tokens.access).toBeDefined();
    });
  });
});
