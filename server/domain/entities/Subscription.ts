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
  constructor(
    public readonly orgId: string,
    public plan: Plan = 'free',
    public status: SubscriptionStatus = 'trialing',
    public provider: string = 'manual',
    public providerRef: string | null = null,
    public currentPeriodEnd: Date | null = null,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  isActive(): boolean {
    return ACTIVE_SUBSCRIPTION.includes(this.status);
  }
}
