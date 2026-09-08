import { describe, it, expect, vi } from 'vitest';
import { createRequirePlan } from './requirePlan';
import { ISubscriptionRepository } from '../../domain/interfaces/ITenant';
import { Subscription } from '../../domain/entities/Subscription';

function reqWithTenant(orgId: string): any {
  return { tenant: { orgId } };
}
function res() {
  const r: any = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json = vi.fn().mockReturnValue(r);
  return r;
}

describe('requirePlan', () => {
  it('allows an active subscription on an allowed plan', async () => {
    const repo = {
      async findByOrgId(orgId: string) { return new Subscription(orgId, 'pro', 'active'); },
    } as unknown as ISubscriptionRepository;
    const gate = createRequirePlan(repo)('pro', 'enterprise');
    const next = vi.fn();
    await gate(reqWithTenant('o1'), res(), next);
    expect(next).toHaveBeenCalled();
  });

  it('403s with upgrade_required on the wrong plan', async () => {
    const repo = {
      async findByOrgId(orgId: string) { return new Subscription(orgId, 'free', 'active'); },
    } as unknown as ISubscriptionRepository;
    const gate = createRequirePlan(repo)('pro');
    const r = res();
    const next = vi.fn();
    await gate(reqWithTenant('o1'), r, next);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'upgrade_required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('403s past_due subscriptions even on the right plan', async () => {
    const repo = {
      async findByOrgId(orgId: string) { return new Subscription(orgId, 'pro', 'past_due'); },
    } as unknown as ISubscriptionRepository;
    const gate = createRequirePlan(repo)('pro');
    const r = res();
    const next = vi.fn();
    await gate(reqWithTenant('o1'), r, next);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s when no subscription row exists', async () => {
    const repo = { async findByOrgId() { return null; } } as unknown as ISubscriptionRepository;
    const gate = createRequirePlan(repo)('free');
    const r = res();
    const next = vi.fn();
    await gate(reqWithTenant('o1'), r, next);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows past_due inside dunning grace, denies after expiry', async () => {
    const inGrace = new Subscription('o1', 'pro', 'past_due');
    inGrace.graceUntil = new Date(Date.now() + 3600_000);
    const repoGrace = { async findByOrgId() { return inGrace; } } as unknown as ISubscriptionRepository;
    const next1 = vi.fn();
    await createRequirePlan(repoGrace)('pro')(reqWithTenant('o1'), res(), next1);
    expect(next1).toHaveBeenCalled();

    const expired = new Subscription('o1', 'pro', 'past_due');
    expired.graceUntil = new Date(Date.now() - 1000);
    const repoExpired = { async findByOrgId() { return expired; } } as unknown as ISubscriptionRepository;
    const r = res();
    const next2 = vi.fn();
    await createRequirePlan(repoExpired)('pro')(reqWithTenant('o1'), r, next2);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(next2).not.toHaveBeenCalled();
  });
});
