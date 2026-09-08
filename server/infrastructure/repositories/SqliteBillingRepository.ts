import { db } from '../database';
import { IOrganizationRepository, ISubscriptionRepository } from '../../domain/interfaces/ITenant';
import { Organization, OrgStatus } from '../../domain/entities/Organization';
import { Subscription, Plan, SubscriptionStatus } from '../../domain/entities/Subscription';

function now(): string {
  return new Date().toISOString();
}

/**
 * Tenancy + billing adapter. One class implements both ports because both
 * are tiny org-scoped lookups over the same tables; split them if either
 * grows provider-specific behavior (e.g. Stripe webhook writes).
 */
export class SqliteBillingRepository implements IOrganizationRepository, ISubscriptionRepository {
  // -- organizations --
  async findById(id: string): Promise<Organization | null> {
    const r = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as any;
    if (!r) return null;
    return new Organization(r.id, r.name, r.slug, r.plan, r.status as OrgStatus, new Date(r.created_at));
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const r = db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug) as any;
    if (!r) return null;
    return new Organization(r.id, r.name, r.slug, r.plan, r.status as OrgStatus, new Date(r.created_at));
  }

  // One class serves both ports (tiny org-scoped lookups). Overloads keep
  // each PORT's signature exact while sharing one implementation.
  async save(org: Organization): Promise<void>;
  async save(sub: Subscription): Promise<void>;
  async save(entity: Organization | Subscription): Promise<void> {
    if (entity instanceof Organization) {
      db.prepare(
        `INSERT INTO organizations (id, name, slug, plan, status, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, plan=excluded.plan, status=excluded.status`
      ).run(entity.id, entity.name, entity.slug, entity.plan, entity.status, entity.createdAt.toISOString());
      return;
    }
    db.prepare(
      `INSERT INTO subscriptions (org_id, plan, status, provider, provider_ref, customer_ref, grace_until, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id) DO UPDATE SET plan=excluded.plan, status=excluded.status, provider=excluded.provider,
         provider_ref=excluded.provider_ref, customer_ref=excluded.customer_ref, grace_until=excluded.grace_until,
         current_period_end=excluded.current_period_end, updated_at=excluded.updated_at`
    ).run(
      entity.orgId, entity.plan, entity.status, entity.provider, entity.providerRef,
      entity.customerRef, entity.graceUntil?.toISOString() ?? null,
      entity.currentPeriodEnd?.toISOString() ?? null,
      entity.createdAt.toISOString(), now()
    );
  }

  async recordWebhookEvent(eventId: string, type: string): Promise<boolean> {
    // First insert wins; concurrent duplicate delivery gets 0 changes.
    const res = db.prepare(
      'INSERT INTO webhook_events (event_id, type, received_at) VALUES (?, ?, ?) ON CONFLICT(event_id) DO NOTHING'
    ).run(eventId, type, now());
    return Number(res.changes) === 1;
  }

  // -- subscriptions (billing seam) --
  async findByOrgId(orgId: string): Promise<Subscription | null> {
    const r = db.prepare('SELECT * FROM subscriptions WHERE org_id = ?').get(orgId) as any;
    if (!r) return null;
    return this.row(r);
  }

  async findByProviderRef(providerRef: string): Promise<Subscription | null> {
    const r = db.prepare('SELECT * FROM subscriptions WHERE provider_ref = ?').get(providerRef) as any;
    if (!r) return null;
    return this.row(r);
  }

  private row(r: any): Subscription {
    return new Subscription(
      r.org_id, r.plan as Plan, r.status as SubscriptionStatus, r.provider, r.provider_ref,
      r.current_period_end ? new Date(r.current_period_end) : null,
      new Date(r.created_at), new Date(r.updated_at),
      r.customer_ref ?? null,
      r.grace_until ? new Date(r.grace_until) : null
    );
  }

  async updatePlan(orgId: string, plan: Plan, status: SubscriptionStatus): Promise<Subscription> {
    const existing = await this.findByOrgId(orgId);
    const sub = existing ?? new Subscription(orgId);
    sub.plan = plan;
    sub.status = status;
    sub.updatedAt = new Date();
    await this.save(sub);
    return sub;
  }
}
