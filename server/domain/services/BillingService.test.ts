import { describe, it, expect, beforeEach } from 'vitest';
import { BillingService, mapStripeStatus } from './BillingService';
import { ISubscriptionRepository, IOrganizationRepository } from '../../domain/interfaces/ITenant';
import { Organization } from '../../domain/entities/Organization';
import { Subscription, Plan, SubscriptionStatus } from '../../domain/entities/Subscription';

// Fakes: billing logic is pure port orchestration, so doubles suffice.
class FakeSubs implements ISubscriptionRepository {
  subs = new Map<string, Subscription>();
  events: string[] = [];
  async findByOrgId(orgId: string) { return this.subs.get(orgId) ?? null; }
  async findByProviderRef(ref: string) {
    for (const s of this.subs.values()) if (s.providerRef === ref) return s;
    return null;
  }
  async save(s: Subscription) { this.subs.set(s.orgId, s); }
  async updatePlan(orgId: string, plan: Plan, status: SubscriptionStatus) {
    const s = this.subs.get(orgId) ?? new Subscription(orgId);
    s.plan = plan; s.status = status;
    this.subs.set(orgId, s);
    return s;
  }
  async recordWebhookEvent(eventId: string) {
    if (this.events.includes(eventId)) return false;
    this.events.push(eventId);
    return true;
  }
}

class FakeOrgs implements IOrganizationRepository {
  orgs = new Map<string, Organization>();
  async findById(id: string) { return this.orgs.get(id) ?? null; }
  async findBySlug() { return null; }
  async save(o: Organization) { this.orgs.set(o.id, o); }
}

describe('BillingService', () => {
  let svc: BillingService;
  let subs: FakeSubs;
  let orgs: FakeOrgs;

  beforeEach(() => {
    subs = new FakeSubs();
    orgs = new FakeOrgs();
    svc = new BillingService(subs, orgs);
    orgs.save(new Organization('o1', 'Acme', 'acme'));
    subs.save(new Subscription('o1', 'free', 'trialing'));
  });

  it('claimEvent is first-wins (idempotency)', async () => {
    expect(await svc.claimEvent('evt_1', 'x')).toBe(true);
    expect(await svc.claimEvent('evt_1', 'x')).toBe(false);
  });

  it('completeCheckout wires plan + refs and clears grace', async () => {
    const sub = await svc.completeCheckout({ orgId: 'o1', plan: 'pro', subscriptionId: 'sub_1', customerId: 'cus_1' });
    expect(sub.plan).toBe('pro');
    expect(sub.status).toBe('active');
    expect(sub.provider).toBe('stripe');
    expect(sub.providerRef).toBe('sub_1');
    expect(sub.customerRef).toBe('cus_1');
    expect(sub.hasAccess()).toBe(true);
    expect((await orgs.findById('o1'))?.plan).toBe('pro');
  });

  it('syncSubscription maps status and never applies unknown prices', async () => {
    await svc.completeCheckout({ orgId: 'o1', plan: 'pro', subscriptionId: 'sub_1', customerId: 'cus_1' });
    const synced = await svc.syncSubscription({ subscriptionId: 'sub_1', stripeStatus: 'active', pricePlan: null });
    expect(synced.status).toBe('active');
    expect(synced.plan).toBe('pro'); // unknown price -> plan untouched
    const upgraded = await svc.syncSubscription({ subscriptionId: 'sub_1', stripeStatus: 'active', pricePlan: 'enterprise' });
    expect(upgraded.plan).toBe('enterprise');
    expect((await orgs.findById('o1'))?.plan).toBe('enterprise');
  });

  it('cancelSubscription cuts access immediately', async () => {
    await svc.completeCheckout({ orgId: 'o1', plan: 'pro', subscriptionId: 'sub_1', customerId: 'cus_1' });
    const sub = await svc.cancelSubscription('sub_1');
    expect(sub.status).toBe('canceled');
    expect(sub.hasAccess()).toBe(false);
    expect((await orgs.findById('o1'))?.plan).toBe('free');
  });

  it('dunning: payment failure grants grace, success clears it', async () => {
    await svc.completeCheckout({ orgId: 'o1', plan: 'pro', subscriptionId: 'sub_1', customerId: 'cus_1' });
    const failed = await svc.recordPaymentFailure('sub_1');
    expect(failed.status).toBe('past_due');
    expect(failed.graceUntil).not.toBeNull();
    expect(failed.hasAccess()).toBe(true); // grace keeps access

    const ok = await svc.recordPaymentSuccess('sub_1');
    expect(ok.status).toBe('active');
    expect(ok.graceUntil).toBeNull();
  });

  it('grace expiry denies access', async () => {
    await svc.completeCheckout({ orgId: 'o1', plan: 'pro', subscriptionId: 'sub_1', customerId: 'cus_1' });
    const sub = (await subs.findByOrgId('o1'))!;
    sub.status = 'past_due';
    sub.graceUntil = new Date(Date.now() - 1000); // yesterday
    expect(sub.hasAccess()).toBe(false);
  });

  it('mapStripeStatus covers the webhook vocabulary', () => {
    expect(mapStripeStatus('trialing')).toEqual({ status: 'trialing', grace: false });
    expect(mapStripeStatus('active')).toEqual({ status: 'active', grace: false });
    expect(mapStripeStatus('past_due')).toEqual({ status: 'past_due', grace: true });
    expect(mapStripeStatus('unpaid')).toEqual({ status: 'past_due', grace: true });
    expect(mapStripeStatus('canceled')).toEqual({ status: 'canceled', grace: false });
    expect(mapStripeStatus('weird_future_status')).toEqual({ status: 'incomplete', grace: false });
  });
});
