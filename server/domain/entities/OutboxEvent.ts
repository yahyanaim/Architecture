export type OutboxStatus = 'pending' | 'processing' | 'published' | 'failed';

export class OutboxEvent {
  constructor(
    public readonly id: string,
    public readonly aggregateType: string,
    public readonly aggregateId: string,
    public readonly eventType: string,
    public readonly payload: Record<string, unknown>,
    public status: OutboxStatus = 'pending',
    public retryCount: number = 0,
    public lastError: string | null = null,
    public readonly createdAt: Date = new Date(),
    public publishedAt: Date | null = null
  ) {}

  static create(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): OutboxEvent {
    return new OutboxEvent(
      globalThis.crypto.randomUUID(),
      aggregateType,
      aggregateId,
      eventType,
      payload
    );
  }
}
