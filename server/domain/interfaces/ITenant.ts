import { Organization } from '../entities/Organization';
import { Subscription, Plan, SubscriptionStatus } from '../entities/Subscription';

// PORTS for tenancy + billing. Same hexagonal rule as `IUserRepository`:
// domain-owned contracts, infrastructure-supplied adapters. `plan`/`status`
// are plain data here; enforcement lives in `requirePlan` middleware.

// Workspace CRUD (admin/support flows; end users never touch this directly).
export interface IOrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  save(org: Organization): Promise<void>;
}

// Billing seam store. The ONLY writer in production should be the provider
// webhook handler; app code reads via `requirePlan`. Row-per-org invariant:
// every org gets a (free/trialing) row at creation.
export interface ISubscriptionRepository {
  findByOrgId(orgId: string): Promise<Subscription | null>;
  /** Reverse lookup for webhooks (Stripe sends subscription id, not org). */
  findByProviderRef(providerRef: string): Promise<Subscription | null>;
  save(sub: Subscription): Promise<void>;
  updatePlan(orgId: string, plan: Plan, status: SubscriptionStatus): Promise<Subscription>;
  /**
   * Webhook idempotency ledger: returns true on FIRST insert, false when the
   * event was already seen (replay). Stripe retries deliveries, so the route
   * must check this BEFORE applying any state change.
   */
  recordWebhookEvent(eventId: string, type: string): Promise<boolean>;
}

// Session + single-use token store (refresh rotation, verify/reset/invite).
// Secrets are ALWAYS stored hashed (SHA-256); plaintext exists only in
// transit (cookie/email) and is never persisted.
export interface RefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
  createdAt: Date;
}

export type AuthTokenType = 'verify' | 'reset' | 'invite';

export interface AuthToken {
  id: string;
  userId: string | null;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  meta: Record<string, unknown>;
}

export interface ITokenStore {
  // -- opaque refresh sessions --
  createRefresh(input: { userId: string; tokenHash: string; expiresAt: Date; ip?: string }): Promise<RefreshSession>;
  findRefreshByHash(tokenHash: string): Promise<RefreshSession | null>;
  revokeRefresh(id: string, replacedBy?: string | null): Promise<void>;
  revokeAllForUser(userId: string): Promise<number>;
  deleteExpiredRefresh(before?: Date): Promise<number>;
  // -- single-use tokens (verify / reset / invite) --
  createAuthToken(input: {
    userId: string | null;
    type: AuthTokenType;
    tokenHash: string;
    expiresAt: Date;
    meta?: Record<string, unknown>;
  }): Promise<AuthToken>;
  /** Atomically marks the token used and returns it; null if unknown/used/expired. */
  consumeAuthToken(tokenHash: string, type: AuthTokenType): Promise<AuthToken | null>;
}
