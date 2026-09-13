import { Plan } from './Subscription';

// TENANCY ROOT: every user belongs to exactly one organization (workspace).
// Shared-schema multi-tenancy — isolation is enforced by org-scoped
// repository queries + `resolveTenant` middleware, never by client input.
//
// NOTE ON PLAN: `Subscription` is the authoritative source of truth for billing,
// stripe state, and feature gating (`requirePlan`). `Organization.plan` is a
// denormalized cache kept in sync for fast workspace listings without a join.
export type OrgStatus = 'active' | 'suspended';

export class Organization {
  constructor(
    public readonly id: string,
    public name: string,
    public slug: string,
    public plan: Plan = 'free',
    public status: OrgStatus = 'active',
    public readonly createdAt: Date = new Date()
  ) {}
}
