import crypto from 'crypto';

export class WebhookEndpoint {
  constructor(
    public readonly id: string,
    public readonly orgId: string,
    public url: string,
    public secret: string,
    public description: string | null,
    public events: string[],
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  static generateSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }

  static create(
    orgId: string,
    url: string,
    events: string[] = ['*'],
    description: string | null = null,
    secret?: string
  ): WebhookEndpoint {
    const now = new Date();
    return new WebhookEndpoint(
      crypto.randomUUID(),
      orgId,
      url,
      secret || WebhookEndpoint.generateSecret(),
      description,
      events.length > 0 ? events : ['*'],
      true,
      now,
      now
    );
  }

  matchesEvent(eventType: string): boolean {
    if (!this.isActive) return false;
    for (const pattern of this.events) {
      if (pattern === '*' || pattern === eventType) return true;
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -1); // e.g. "user."
        if (eventType.startsWith(prefix)) return true;
      }
    }
    return false;
  }
}
