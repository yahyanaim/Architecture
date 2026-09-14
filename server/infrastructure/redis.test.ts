import { describe, it, expect, vi } from 'vitest';
import { getRedisClient, isRedisActive } from './redis';
import { RedisStore } from 'rate-limit-redis';
import { getMetricsSnapshot } from './observability';

describe('Redis Infrastructure & Multi-Instance State', () => {
  it('defaults to in-memory fallback when REDIS_URL is unset', () => {
    if (!process.env.REDIS_URL) {
      expect(isRedisActive).toBe(false);
      expect(getRedisClient()).toBeNull();
    }
  });

  it('instantiates RedisStore adapter correctly when sendCommand is provided', async () => {
    const mockClient = {
      call: vi.fn().mockImplementation(async (...args: string[]) => {
        if (args[0] === 'SCRIPT' && args[1] === 'LOAD') {
          return 'mocksha123';
        }
        return 'OK';
      }),
    };

    const store = new RedisStore({
      sendCommand: (...args: string[]) => mockClient.call(args[0] || '', ...args.slice(1)) as any,
      prefix: 'rl:test:',
    });

    expect(store).toBeDefined();
    expect(typeof store.increment).toBe('function');
  });

  it('shares rate limits across simulated multiple app instances using shared store', async () => {
    const sharedCounters = new Map<string, number>();

    // Simulated Redis memory store representing shared state
    const sharedRedis = {
      call: vi.fn().mockImplementation(async (cmd: string, ...args: any[]) => {
        if (cmd === 'SCRIPT' && args[0] === 'LOAD') {
          return 'mock-script-sha';
        }
        if (cmd === 'EVALSHA') {
          // Key is args[2] in EVALSHA <sha> 1 <key> <windowMs>
          const key = String(args[2]);
          const current = (sharedCounters.get(key) ?? 0) + 1;
          sharedCounters.set(key, current);
          return [current, 60000];
        }
        return 'OK';
      }),
    };

    const storeInstance1 = new RedisStore({
      sendCommand: (...args: string[]) => sharedRedis.call(args[0] || '', ...args.slice(1)) as any,
      prefix: 'rl:shared:',
    });

    const storeInstance2 = new RedisStore({
      sendCommand: (...args: string[]) => sharedRedis.call(args[0] || '', ...args.slice(1)) as any,
      prefix: 'rl:shared:',
    });

    // Initialize both stores with options as express-rate-limit does
    await storeInstance1.init({ windowMs: 60000 } as any);
    await storeInstance2.init({ windowMs: 60000 } as any);

    // App Instance 1 increments request count for 192.168.1.1
    const res1 = await storeInstance1.increment('192.168.1.1');
    expect(res1.totalHits).toBe(1);

    // App Instance 2 increments request count for the SAME IP: hits must accumulate globally
    const res2 = await storeInstance2.increment('192.168.1.1');
    expect(res2.totalHits).toBe(2);

    // App Instance 1 increments again: count is now 3
    const res3 = await storeInstance1.increment('192.168.1.1');
    expect(res3.totalHits).toBe(3);
  });

  it('getMetricsSnapshot returns structured telemetry object', async () => {
    const snapshot = await getMetricsSnapshot();
    expect(snapshot).toBeDefined();
    expect(typeof snapshot).toBe('object');
  });
});
