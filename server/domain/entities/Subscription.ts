// BILLING SEAM: one subscription row per org, created at org birth
// (free/trialing). Real providers (Stripe) only UPDATE this row via webhooks;
// plan gating lives in `requirePlan` middleware reading it. Controllers never
// touch provider APIs directly — when billing connects, add a
// `BillingProvider` port + webhook handler that writes here.
export type Plan = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export const ACTIVE_SUBSCRIPTION: SubscriptionStatus[] = ['trialing', 'active'];

export class Subscription {
  // BILLING LIFECYCLE: `provider`/`providerRef` (subscription id) and
  // `customerRef` (Stripe customer id) are written ONLY by the provider
  // webhook via BillingService — app code never invents billing state.
  // `graceUntil` implements dunning: a failed payment flips status to
  // past_due but access continues until the grace expires (see hasAccess).
  constructor(
    public readonly orgId: string,
    public plan: Plan = 'free',
    public status: SubscriptionStatus = 'trialing',
    public provider: string = 'manual',
    public providerRef: string | null = null,
    public currentPeriodEnd: Date | null = null,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public customerRef: string | null = null,
    public graceUntil: Date | null = null
  ) {}

  isActive(): boolean {
    return ACTIVE_SUBSCRIPTION.includes(this.status);
  }

  /** Enforcement entry point (used by requirePlan): active plans pass, plus
   * past_due inside its dunning grace. Everything else is denied. */
  hasAccess(): boolean {
    if (this.isActive()) return true;
    if (this.status === 'past_due' && this.graceUntil && this.graceUntil.getTime() > Date.now()) {
      return true;
    }
    return false;
  }
}
