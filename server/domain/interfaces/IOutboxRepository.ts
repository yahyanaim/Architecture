import { OutboxEvent } from '../entities/OutboxEvent';

export interface IOutboxRepository {
  save(event: OutboxEvent): Promise<void>;
  fetchPending(limit?: number): Promise<OutboxEvent[]>;
  markProcessing(id: string): Promise<boolean>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: string, maxRetries?: number): Promise<void>;
}
