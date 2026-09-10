import { Pool } from '@neondatabase/serverless';
import { IOrganizationRepository, ISubscriptionRepository } from '../../domain/interfaces/ITenant';
import { Organization, OrgStatus } from '../../domain/entities/Organization';
import { Subscription, Plan, SubscriptionStatus } from '../../domain/entities/Subscription';
import { PostgresExecutor } from './PostgresUserRepository';

function now(): string {
  return new Date().toISOString();
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  created_at: string | Date;
}

interface SubRow {
  org_id: string;
  plan: string;
  status: string;
  provider: string;
  provider_ref: string;
  customer_ref: string | null;
  grace_until: string | Date | null;
  current_period_end: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export class PostgresBillingRepository implements IOrganizationRepository, ISubscriptionRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    if (db) {
      this.db = db;
    } else {
      const connectionString = process.env.DATABASE_URL;
      this.db = new Pool({ connectionString });
    }
  }

  async findById(id: string): Promise<Organization | null> {
    const res = await this.db.query<OrgRow>('SELECT * FROM organizations WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return new Organization(r.id, r.name, r.slug, r.plan, r.status as OrgStatus, new Date(r.created_at));
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const res = await this.db.query<OrgRow>('SELECT * FROM organizations WHERE slug = $1', [slug]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return new Organization(r.id, r.name, r.slug, r.plan, r.status as OrgStatus, new Date(r.created_at));
  }

  async save(org: Organization): Promise<void>;
  async save(sub: Subscription): Promise<void>;
  async save(entity: Organization | Subscription): Promise<void> {
    if (entity instanceof Organization) {
      const query = `
        INSERT INTO organizations (id, name, slug, plan, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          plan = EXCLUDED.plan,
          status = EXCLUDED.status
      `;
      await this.db.query(query, [
        entity.id,
        entity.name,
        entity.slug,
        entity.plan,
        entity.status,
        entity.createdAt.toISOString()
      ]);
      return;
    }

    const query = `
      INSERT INTO subscriptions (org_id, plan, status, provider, provider_ref, customer_ref, grace_until, current_period_end, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(org_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        provider = EXCLUDED.provider,
        provider_ref = EXCLUDED.provider_ref,
        customer_ref = EXCLUDED.customer_ref,
        grace_until = EXCLUDED.grace_until,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = EXCLUDED.updated_at
    `;
    await this.db.query(query, [
      entity.orgId,
      entity.plan,
      entity.status,
      entity.provider,
      entity.providerRef,
      entity.customerRef,
      entity.graceUntil?.toISOString() ?? null,
      entity.currentPeriodEnd?.toISOString() ?? null,
      entity.createdAt.toISOString(),
      now()
    ]);
  }

  async recordWebhookEvent(eventId: string, type: string): Promise<boolean> {
    const res = await this.db.query(
      'INSERT INTO webhook_events (event_id, type, received_at) VALUES ($1, $2, $3) ON CONFLICT(event_id) DO NOTHING',
      [eventId, type, now()]
    );
    return (res.rowCount ?? 0) === 1;
  }

  async findByOrgId(orgId: string): Promise<Subscription | null> {
    const res = await this.db.query<SubRow>('SELECT * FROM subscriptions WHERE org_id = $1', [orgId]);
    if (!res.rows[0]) return null;
    return this.toSubscription(res.rows[0]);
  }

  async findByProviderRef(providerRef: string): Promise<Subscription | null> {
    const res = await this.db.query<SubRow>('SELECT * FROM subscriptions WHERE provider_ref = $1', [providerRef]);
    if (!res.rows[0]) return null;
    return this.toSubscription(res.rows[0]);
  }

  private toSubscription(r: SubRow): Subscription {
    return new Subscription(
      r.org_id,
      r.plan as Plan,
      r.status as SubscriptionStatus,
      r.provider,
      r.provider_ref,
      r.current_period_end ? new Date(r.current_period_end) : null,
      new Date(r.created_at),
      new Date(r.updated_at),
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

    const org = await this.findById(orgId);
    if (org) {
      org.plan = plan;
      await this.save(org);
    }

    return sub;
  }
}
