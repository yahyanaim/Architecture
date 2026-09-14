/**
 * Redis client handle (ioredis).
 *
 * ARCHITECTURE: Infrastructure adapter detail — domain code never imports this.
 * Used for shared transient state across distributed instances:
 *   - Distributed rate limiting (RedisStore)
 *   - Shared telemetry / request metrics counters
 *   - Distributed queue lock synchronization
 *
 * LIFECYCLE: Lazy connection when `REDIS_URL` is set in configuration.
 * When `REDIS_URL` is unset, callers fall back to in-memory adapters.
 */
import Redis from 'ioredis';
import { REDIS_URL } from '../config/index';
import { logger } from './observability';

let client: Redis | null = null;

export const isRedisActive = Boolean(REDIS_URL);

export function getRedisClient(): Redis | null {
  if (!REDIS_URL) return null;

  if (!client) {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    client.on('error', (err) => {
      logger.warn('[redis] connection error', { error: err.message });
    });

    client.on('connect', () => {
      logger.info('[redis] connected');
    });
  }

  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}
