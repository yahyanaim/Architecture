// TENANCY ROOT: every user belongs to exactly one organization (workspace).
// Shared-schema multi-tenancy — isolation is enforced by org-scoped
// repository queries + `resolveTenant` middleware, never by client input.
export type OrgStatus = 'active' | 'suspended';

export class Organization {
  constructor(
    public readonly id: string,
    public name: string,
    public slug: string,
    public plan: string = 'free',
    public status: OrgStatus = 'active',
    public readonly createdAt: Date = new Date()
  ) {}
}
