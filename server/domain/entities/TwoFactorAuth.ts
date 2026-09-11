export class TwoFactorAuth {
  constructor(
    public readonly userId: string,
    public secret: string,
    public isEnabled: boolean,
    public recoveryCodes: string[],
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  static create(userId: string, secret: string, recoveryCodes: string[]): TwoFactorAuth {
    const now = new Date();
    return new TwoFactorAuth(userId, secret, false, recoveryCodes, now, now);
  }
}
