export class PasskeyCredential {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly publicKey: string,
    public counter: number,
    public deviceType: string,
    public backedUp: boolean,
    public transports: string[] | null,
    public name: string,
    public readonly createdAt: Date = new Date(),
    public lastUsedAt: Date | null = null
  ) {}

  recordUsage(counter: number, backedUp: boolean = this.backedUp): void {
    if (counter <= this.counter && (counter !== 0 || this.counter !== 0)) {
      throw new Error('Authenticator counter decreased; potential replay attack.');
    }
    this.counter = counter;
    this.backedUp = backedUp;
    this.lastUsedAt = new Date();
  }

  rename(newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('Credential name cannot be empty');
    }
    this.name = trimmed;
  }
}
