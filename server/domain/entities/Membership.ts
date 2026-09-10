export type MembershipRole = 'admin' | 'user';

export class Membership {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly orgId: string,
    public role: MembershipRole,
    public readonly createdAt: Date
  ) {
    if (role !== 'admin' && role !== 'user') {
      throw new Error(`Invalid membership role: ${role}. Must be 'admin' or 'user'`);
    }
  }

  static create(userId: string, orgId: string, role: MembershipRole = 'user'): Membership {
    const id = globalThis.crypto.randomUUID();
    return new Membership(id, userId, orgId, role, new Date());
  }

  promoteToAdmin(): void {
    this.role = 'admin';
  }

  demoteToUser(): void {
    this.role = 'user';
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }
}
