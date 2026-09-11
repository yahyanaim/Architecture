import { IOutboxRepository } from '../../domain/interfaces/IOutboxRepository';
import { OutboxEvent } from '../../domain/entities/OutboxEvent';
import { logger } from '../observability';

export type OutboxHandler = (event: OutboxEvent) => Promise<void>;

export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private handlers = new Map<string, OutboxHandler[]>();

  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly pollIntervalMs = 5000
  ) {}

  subscribe(eventType: string, handler: OutboxHandler): void {
    const list = this.handlers.get(eventType) || [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  async processPending(limit = 20): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let processed = 0;

    try {
      const pending = await this.outboxRepository.fetchPending(limit);
      for (const event of pending) {
        const acquired = await this.outboxRepository.markProcessing(event.id);
        if (!acquired) continue;

        try {
          const listeners = this.handlers.get(event.eventType) || [];
          for (const handler of listeners) {
            await handler(event);
          }
          await this.outboxRepository.markPublished(event.id);
          processed++;
        } catch (err: any) {
          logger.error('[outbox] dispatch failed', {
            id: event.id,
            eventType: event.eventType,
            error: err.message,
          });
          await this.outboxRepository.markFailed(event.id, err.message ?? 'Unknown error');
        }
      }
    } finally {
      this.running = false;
    }

    return processed;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.processPending().catch((err) =>
        logger.error('[outbox] loop error', { error: err.message })
      );
    }, this.pollIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
