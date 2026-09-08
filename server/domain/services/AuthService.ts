import { IUserRepository } from '../interfaces/IUserRepository';
import {
  IOrganizationRepository, ISubscriptionRepository, ITokenStore, AuthTokenType,
} from '../interfaces/ITenant';
import { User, UserRole } from '../entities/User';
import { Organization } from '../entities/Organization';
import { Subscription } from '../entities/Subscription';
import { BusinessException } from '../exceptions/BusinessException';
import { NotFoundException } from '../exceptions/NotFoundException';
import { ITokenService } from '../interfaces/ITokenService';
import { defaultTokenService, JwtTokenService } from '../../infrastructure/security/JwtTokenService';
import {
  ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS,
} from '../../config/index';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  orgId: string;
}

export interface SessionTokens {
  /** Short-lived JWT (minutes). Sent as httpOnly `access` cookie. */
  access: string;
  /** Long-lived opaque token (days). Stored HASHED server-side, rotated on every use. */
  refresh: string;
}

export interface LoginResult {
  user: User;
  org: Organization;
  tokens: SessionTokens;
}

/** Parses '15m'/'2h'/'7d'/'30s' into ms for cookie maxAge. */
export function parseTtlMs(ttl: string, fallbackMs: number): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(ttl.trim());
  if (!m || !m[1] || !m[2]) return fallbackMs;
  const n = parseInt(m[1], 10);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

export const ACCESS_COOKIE_MAX_AGE_MS = parseTtlMs(ACCESS_TOKEN_TTL, 15 * 60_000);
export const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TOKEN_TTL_DAYS * 86_400_000;

/**
 * Auth domain service. Owns identity lifecycle: registration (with workspace
 * bootstrap), login, refresh rotation, verification, password reset, invites.
 * Depends ONLY on ports — no express, no SQL, no mailer. Side effects that
 * cross boundaries (emails) are returned as data (plaintext tokens) for the
 * API layer to enqueue; the service never sends mail itself.
 */
export class AuthService {
  private readonly tokenService: ITokenService;

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly orgRepository: IOrganizationRepository,
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly tokenStore: ITokenStore,
    jwtSecretOrTokenService?: string | ITokenService
  ) {
    if (typeof jwtSecretOrTokenService === 'string') {
      this.tokenService = new JwtTokenService(jwtSecretOrTokenService);
    } else if (jwtSecretOrTokenService) {
      this.tokenService = jwtSecretOrTokenService;
    } else {
      this.tokenService = defaultTokenService;
    }
  }

  // -- registration -------------------------------------------------------
  // REGISTRATION INVARIANT (security-critical): the very first account in an
  // empty store becomes instance 'admin' (bootstrap), every later one is
  // 'user'. No `role` input exists — accepting one would allow self-promotion.
  // SAAS: every registration ALSO bootstraps a personal Organization +
  // (free/trialing) Subscription row, so billing/enforcement always has a
  // row to read. Invited users skip this (they join the inviter's org).
  async register(
    name: string, email: string, password: string
  ): Promise<LoginResult & { verifyToken: string }> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new BusinessException('User with this email already exists');
    }

    const hasUsers = await this.userRepository.hasUsers();
    const role: UserRole = !hasUsers ? 'admin' : 'user';

    const org = new Organization(globalThis.crypto.randomUUID(), `${name}'s workspace`, this.tokenService.slugify(name));
    await this.orgRepository.save(org);
    await this.subscriptionRepository.save(new Subscription(org.id, 'free', 'trialing'));

    const user = await User.create(name, email, password, role);
    user.orgId = org.id;
    await this.userRepository.save(user);

    const tokens = await this.issueSession(user.id, user);
    const verifyToken = await this.mintAuthToken(user.id, 'verify', 24 * 3600_000, {});
    return { user, org, tokens, verifyToken };
  }

  // -- login ---------------------------------------------------------------
  // LOGIN LIFECYCLE: active? -> locked? -> password? Failures persist via
  // `recordFailedAttempt()` (5 strikes = 15-min lock) — account-level throttle
  // on top of the IP + per-account rate limiters on the route. Success resets
  // the counter and mints a fresh session pair. Unverified users MAY log in
  // (verification is enforced opt-in via `requireVerified`, not here) so
  // rollout never hard-locks existing accounts.
  async login(email: string, password: string, ip?: string): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BusinessException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new BusinessException('Account is disabled');
    }

    if (user.isLocked()) {
      const minutes = Math.ceil((user.lockedUntil!.getTime() - Date.now()) / 60000);
      throw new BusinessException(`Account is locked. Try again in ${minutes} minutes`);
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      user.recordFailedAttempt();
      await this.userRepository.save(user);
      throw new BusinessException('Invalid email or password');
    }

    user.resetFailedAttempts();
    await this.userRepository.save(user);

    const org = await this.ensureOrg(user);
    const tokens = await this.issueSession(user.id, user, ip);
    return { user, org, tokens };
  }

  // -- refresh rotation ----------------------------------------------------
  // REUSE DETECTION: each refresh use revokes the old row and links the
  // replacement. Presenting an already-revoked token means it was stolen
  // (the legitimate client moved on) -> revoke the WHOLE chain immediately.
  async refreshSession(refreshToken: string, ip?: string): Promise<LoginResult> {
    const row = await this.tokenStore.findRefreshByHash(this.tokenService.hashToken(refreshToken));
    if (!row) throw new BusinessException('Invalid session');
    if (row.expiresAt.getTime() < Date.now()) throw new BusinessException('Session expired');

    if (row.revokedAt) {
      if (row.replacedBy) {
        // Token was rotated already and someone replayed it: assume theft.
        await this.tokenStore.revokeAllForUser(row.userId);
        throw new BusinessException('Session compromised. All sessions revoked — please log in again.');
      }
      throw new BusinessException('Invalid session');
    }

    const user = await this.userRepository.findById(row.userId);
    if (!user) throw new BusinessException('Invalid session');
    if (!user.isActive) throw new BusinessException('Account is disabled');

    const tokens = await this.issueSession(user.id, user, ip);
    const next = await this.tokenStore.findRefreshByHash(this.tokenService.hashToken(tokens.refresh));
    await this.tokenStore.revokeRefresh(row.id, next?.id ?? null);

    const org = await this.ensureOrg(user);
    return { user, org, tokens };
  }

  /** Idempotent: revoking an unknown/absent token still succeeds. */
  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const row = await this.tokenStore.findRefreshByHash(this.tokenService.hashToken(refreshToken));
    if (row && !row.revokedAt) await this.tokenStore.revokeRefresh(row.id);
  }

  /** Credential change / compromise response: kills every session at once. */
  async revokeAllSessions(userId: string): Promise<number> {
    return this.tokenStore.revokeAllForUser(userId);
  }

  // -- email verification ---------------------------------------------------
  // Enumeration-safe: returns null (controller still answers 200) when there
  // is nothing to do, so attackers can't probe which emails are registered.
  async requestEmailVerification(email: string): Promise<string | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || user.isVerified) return null;
    return this.mintAuthToken(user.id, 'verify', 24 * 3600_000, {});
  }

  async verifyEmail(token: string): Promise<User> {
    const row = await this.tokenStore.consumeAuthToken(this.tokenService.hashToken(token), 'verify');
    if (!row || !row.userId) throw new BusinessException('Invalid or expired verification link');
    const user = await this.userRepository.findById(row.userId);
    if (!user) throw new NotFoundException('User not found');
    user.markVerified();
    await this.userRepository.save(user);
    return user;
  }

  // -- password reset --------------------------------------------------------
  async requestPasswordReset(email: string): Promise<string | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return null; // enumeration-safe (see above)
    return this.mintAuthToken(user.id, 'reset', 3600_000, {});
  }

  // CREDENTIAL CHANGE = session kill: all refresh tokens die with the old
  // password, and the lockout counter resets (owner proved email ownership).
  async resetPassword(token: string, newPassword: string): Promise<User> {
    const row = await this.tokenStore.consumeAuthToken(this.tokenService.hashToken(token), 'reset');
    if (!row || !row.userId) throw new BusinessException('Invalid or expired reset link');
    const user = await this.userRepository.findById(row.userId);
    if (!user) throw new NotFoundException('User not found');
    user.password = await User.hashPassword(newPassword);
    user.resetFailedAttempts();
    await this.userRepository.save(user);
    await this.tokenStore.revokeAllForUser(user.id);
    return user;
  }

  // -- invites (admin adds user to THEIR org) --------------------------------
  // Creates a login-disabled account (random unusable password) + single-use
  // invite token. `acceptInvite` sets the real password and verifies the
  // email in one step. Email delivery is the API layer's job (job queue).
  async createInvite(
    name: string, email: string, orgId: string
  ): Promise<{ user: User; inviteToken: string }> {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) throw new BusinessException('User with this email already exists');
    const org = await this.orgRepository.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    const user = await User.create(name, email, this.tokenService.generateRandomToken(24), 'user');
    user.orgId = orgId;
    await this.userRepository.save(user);
    const inviteToken = await this.mintAuthToken(user.id, 'invite', 7 * 86_400_000, { orgId, email });
    return { user, inviteToken };
  }

  async acceptInvite(token: string, password: string, name?: string): Promise<LoginResult> {
    const row = await this.tokenStore.consumeAuthToken(this.tokenService.hashToken(token), 'invite');
    if (!row || !row.userId) throw new BusinessException('Invalid or expired invite link');
    const user = await this.userRepository.findById(row.userId);
    if (!user) throw new NotFoundException('User not found');
    if (name && name.trim().length >= 3) user.name = name.trim();
    user.password = await User.hashPassword(password);
    user.markVerified();
    user.resetFailedAttempts();
    await this.userRepository.save(user);
    const org = await this.ensureOrg(user);
    const tokens = await this.issueSession(user.id, user);
    return { user, org, tokens };
  }

  // -- session primitives -----------------------------------------------------
  async issueSession(userId: string, user?: User | null, ip?: string): Promise<SessionTokens> {
    const account = user ?? (await this.userRepository.findById(userId));
    if (!account) throw new NotFoundException('User not found');
    const payload = { userId: account.id, email: account.email, role: account.role, orgId: account.orgId };
    const access = this.tokenService.signAccessToken(payload);
    const refresh = this.tokenService.generateRandomToken();
    await this.tokenStore.createRefresh({
      userId: account.id,
      tokenHash: this.tokenService.hashToken(refresh),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      ip,
    });
    return { access, refresh };
  }

  /** Verifies a short-lived ACCESS token (used by middleware + tests). */
  verifyToken(token: string): AuthPayload {
    try {
      const payload = this.tokenService.verifyAccessToken(token);
      return payload;
    } catch {
      throw new BusinessException('Invalid or expired token');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  // -- internals ---------------------------------------------------------------
  private async mintAuthToken(userId: string | null, type: AuthTokenType, ttlMs: number, meta: Record<string, unknown>): Promise<string> {
    const token = this.tokenService.generateRandomToken();
    await this.tokenStore.createAuthToken({
      userId, type, tokenHash: this.tokenService.hashToken(token), expiresAt: new Date(Date.now() + ttlMs), meta,
    });
    return token;
  }

  /** Self-heal: legacy/imported users predating orgs get a personal org. */
  private async ensureOrg(user: User): Promise<Organization> {
    const existing = await this.orgRepository.findById(user.orgId);
    if (existing) return existing;
    const org = new Organization(globalThis.crypto.randomUUID(), `${user.name}'s workspace`, this.tokenService.slugify(user.name));
    await this.orgRepository.save(org);
    await this.subscriptionRepository.save(new Subscription(org.id, 'free', 'trialing'));
    user.orgId = org.id;
    await this.userRepository.save(user);
    return org;
  }
}
