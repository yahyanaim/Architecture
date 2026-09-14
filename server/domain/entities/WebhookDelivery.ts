import crypto from 'crypto';

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed';

export class WebhookDelivery {
  constructor(
    public readonly id: string,
    public readonly endpointId: string,
    public readonly orgId: string,
    public readonly eventId: string | null,
    public readonly eventType: string,
    public readonly payload: Record<string, unknown>,
    public requestHeaders: Record<string, string>,
    public responseStatus: number | null = null,
    public responseBody: string | null = null,
    public error: string | null = null,
    public durationMs: number | null = null,
    public status: WebhookDeliveryStatus = 'pending',
    public attempts: number = 1,
    public deliveredAt: Date | null = null,
    public readonly createdAt: Date = new Date()
  ) {}

  static create(
    endpointId: string,
    orgId: string,
    eventType: string,
    payload: Record<string, unknown>,
    requestHeaders: Record<string, string> = {},
    eventId: string | null = null
  ): WebhookDelivery {
    return new WebhookDelivery(
      crypto.randomUUID(),
      endpointId,
      orgId,
      eventId,
      eventType,
      payload,
      requestHeaders,
      null,
      null,
      null,
      null,
      'pending',
      1,
      null,
      new Date()
    );
  }
}
