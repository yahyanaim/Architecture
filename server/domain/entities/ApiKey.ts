export class ApiKey {
  constructor(
    public readonly id: string,
    public readonly orgId: string,
    public readonly userId: string,
    public name: string,
    public readonly keyPrefix: string,
    public readonly keyHash: string,
    public scopes: string[],
    public expiresAt: Date | null = null,
    public lastUsedAt: Date | null = null,
    public readonly createdAt: Date = new Date()
  ) {}

  hasScope(scope: string): boolean {
    if (this.scopes.includes('*') || this.scopes.includes('admin')) return true;
    return this.scopes.includes(scope);
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt.getTime() < Date.now();
  }
}
