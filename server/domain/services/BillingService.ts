import { ISubscriptionRepository, IOrganizationRepository } from '../interfaces/ITenant';
import { Subscription, Plan, SubscriptionStatus } from '../entities/Subscription';
import { BusinessException } from '../exceptions/BusinessException';
import { NotFoundException } from '../exceptions/NotFoundException';

/**
 * Billing domain service — the ONLY writer of subscription state besides org
 * bootstrap (AuthService). Stripe (or any provider) talks to the webhook
 * route, which calls THESE methods; provider SDK types never cross into
 * here — inputs are plain {orgId, plan, subscriptionId, ...}. That keeps the
 * domain provider-agnostic: switching Stripe->Paddle means a new route
 * adapter, zero domain changes.
 *
 * DUNNING MODEL: payment_failed -> status past_due + 7-day grace (access
 * continues via hasAccess()); payment_succeeded -> active, grace cleared;
 * subscription deleted -> canceled (immediate). Grace state is visible on
 * GET /billing/subscription so the UI can show "update payment method".
 */
export const DUNNING_GRACE_MS = 7 * 86_400_000;

export class BillingService {
  constructor(
    private readonly subscriptions: ISubscriptionRepository,
    private readonly orgs: IOrganizationRepository
  ) { }

  /**
   * Idempotency gate: returns false when this event was already processed
   * (Stripe retries). Call BEFORE applying anything; duplicates answer 200
   * without re-applying.
   */
  async claimEvent(eventId: string, type: string): Promise<boolean> {
    return this.subscriptions.recordWebhookEvent(eventId, type);
  }

  private async forOrg(orgId: string): Promise<Subscription> {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');
    const sub = await this.subscriptions.findByOrgId(orgId);
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  private async forSubscription(subscriptionId: string): Promise<Subscription> {
    const sub = await this.subscriptions.findByProviderRef(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  private touch(sub: Subscription): Promise<void> {
    sub.updatedAt = new Date();
    return this.subscriptions.save(sub);
  }

  /** checkout.session.completed: wire the Stripe subscription to our org. */
  async completeCheckout(input: {
    orgId: string; plan: Plan; subscriptionId: string; customerId: string | null;
  }): Promise<Subscription> {
    const sub = await this.forOrg(input.orgId);
    sub.plan = input.plan;
    sub.status = 'active';
    sub.provider = 'stripe';
    sub.providerRef = input.subscriptionId;
    if (input.customerId) sub.customerRef = input.customerId;
    sub.graceUntil = null;
    await this.touch(sub);
    return sub;
  }

  /** customer.subscription.updated: mirror status/plan (price change = plan change). */
  async syncSubscription(input: {
    subscriptionId: string; stripeStatus: string; pricePlan: Plan | null;
  }): Promise<Subscription> {
    const sub = await this.forSubscription(input.subscriptionId);
    const mapped = mapStripeStatus(input.stripeStatus);
    sub.status = mapped.status;
    sub.graceUntil = mapped.grace ? new Date(Date.now() + DUNNING_GRACE_MS) : null;
    // Unknown price ids NEVER downgrade/upgrade blindly — keep current plan.
    if (input.pricePlan) sub.plan = input.pricePlan;
    await this.touch(sub);
    return sub;
  }

  /** customer.subscription.deleted: immediate loss of paid access. */
  async cancelSubscription(subscriptionId: string): Promise<Subscription> {
    const sub = await this.forSubscription(subscriptionId);
    sub.status = 'canceled';
    sub.graceUntil = null;
    await this.touch(sub);
    return sub;
  }

  /** invoice.payment_failed: dunning starts — past_due WITH grace. */
  async recordPaymentFailure(subscriptionId: string): Promise<Subscription> {
    const sub = await this.forSubscription(subscriptionId);
    // Idempotent-ish: refresh the grace window on each failure (latest invoice wins).
    sub.status = 'past_due';
    sub.graceUntil = new Date(Date.now() + DUNNING_GRACE_MS);
    await this.touch(sub);
    return sub;
  }

  /** invoice.payment_succeeded: dunning ends. */
  async recordPaymentSuccess(subscriptionId: string): Promise<Subscription> {
    const sub = await this.forSubscription(subscriptionId);
    if (sub.status === 'past_due') {
      sub.status = 'active';
    }
    sub.graceUntil = null;
    await this.touch(sub);
    return sub;
  }

  assertPlan(plan: string): asserts plan is Plan {
    if (plan !== 'pro' && plan !== 'enterprise') {
      throw new BusinessException('Plan must be pro or enterprise');
    }
  }
}

/** Stripe subscription status -> ours. `unpaid` enters dunning like past_due. */
export function mapStripeStatus(status: string): { status: SubscriptionStatus; grace: boolean } {
  switch (status) {
    case 'trialing':
      return { status: 'trialing', grace: false };
    case 'active':
      return { status: 'active', grace: false };
    case 'past_due':
    case 'unpaid':
      return { status: 'past_due', grace: true };
    case 'canceled':
      return { status: 'canceled', grace: false };
    default:
      return { status: 'incomplete', grace: false };
  }
}
