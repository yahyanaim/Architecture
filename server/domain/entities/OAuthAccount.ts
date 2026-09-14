export type OAuthProvider = 'google' | 'github';

export class OAuthAccount {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly provider: OAuthProvider | string,
    public readonly providerSub: string,
    public readonly orgId: string,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  static create(
    userId: string,
    provider: OAuthProvider | string,
    providerSub: string,
    orgId: string
  ): OAuthAccount {
    return new OAuthAccount(
      globalThis.crypto.randomUUID(),
      userId,
      provider.toLowerCase(),
      providerSub,
      orgId,
      new Date(),
      new Date()
    );
  }
}
