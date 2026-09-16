import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockScope, mockSentry } = vi.hoisted(() => {
  const mockScope = {
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setContext: vi.fn(),
  };

  const mockSentry = {
    init: vi.fn(),
    withScope: vi.fn((cb: (scope: any) => void) => cb(mockScope)),
    captureException: vi.fn(),
    close: vi.fn().mockResolvedValue(true),
  };

  return { mockScope, mockSentry };
});

vi.mock('@sentry/node', () => mockSentry);

import {
  reportError,
  initSentry,
  closeSentry,
  isSentryInitialized,
  runWithTraceContext,
  getTraceContext,
  logger,
} from './observability';
import { startSpan, getTracer } from './telemetry';
import { JobQueue } from './queue';
import { db } from './database';
import { migrate } from './db/migrate';

describe('Observability & Sentry Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes Sentry when DSN is provided', () => {
    const success = initSentry('https://fake@sentry.io/12345', 'production');
    expect(success).toBe(true);
    expect(mockSentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://fake@sentry.io/12345',
        environment: 'production',
      })
    );
    expect(isSentryInitialized()).toBe(true);
  });

  it('reportError captures exception with traceId and requestId tags in Sentry', () => {
    initSentry('https://fake@sentry.io/12345', 'test');

    const testError = new Error('Database deadlocked');
    reportError(testError, {
      traceId: 'trace-abc-123',
      requestId: 'req-xyz-789',
      url: '/api/v1/workspaces',
      method: 'POST',
      email: 'user@example.com',
    });

    expect(mockSentry.captureException).toHaveBeenCalledWith(testError);
    expect(mockScope.setTag).toHaveBeenCalledWith('traceId', 'trace-abc-123');
    expect(mockScope.setTag).toHaveBeenCalledWith('requestId', 'req-xyz-789');
    expect(mockScope.setTag).toHaveBeenCalledWith('node_env', expect.any(String));
    expect(mockScope.setExtra).toHaveBeenCalledWith('url', '/api/v1/workspaces');
    expect(mockScope.setExtra).toHaveBeenCalledWith('method', 'POST');
    expect(mockScope.setContext).toHaveBeenCalledWith(
      'details',
      expect.objectContaining({
        email: '***', // Verified PII redaction
        traceId: 'trace-abc-123',
        requestId: 'req-xyz-789',
      })
    );
  });

  it('AsyncLocalStorage automatically injects traceId and requestId into emitted logs', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    runWithTraceContext({ traceId: 'trace-live-999', requestId: 'req-live-888' }, () => {
      expect(getTraceContext()?.traceId).toBe('trace-live-999');
      logger.info('Testing distributed trace logging', { action: 'test' });
    });

    expect(consoleSpy).toHaveBeenCalled();
    const lastCall = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(lastCall);
    expect(parsed.traceId).toBe('trace-live-999');
    expect(parsed.requestId).toBe('req-live-888');
    expect(parsed.msg).toBe('Testing distributed trace logging');
  });

  it('reportError falls back to active AsyncLocalStorage traceId if not passed in ctx', () => {
    initSentry('https://fake@sentry.io/12345', 'test');

    const testError = new Error('Async context failure');
    runWithTraceContext({ traceId: 'async-trace-001', requestId: 'async-req-002' }, () => {
      reportError(testError, { detail: 'something' });
    });

    expect(mockScope.setTag).toHaveBeenCalledWith('traceId', 'async-trace-001');
    expect(mockScope.setTag).toHaveBeenCalledWith('requestId', 'async-req-002');
    expect(mockSentry.captureException).toHaveBeenCalledWith(testError);
  });

  it('closeSentry cleanly flushes and resets initialized flag', async () => {
    initSentry('https://fake@sentry.io/12345', 'test');
    expect(isSentryInitialized()).toBe(true);
    await closeSentry(500);
    expect(mockSentry.close).toHaveBeenCalledWith(500);
    expect(isSentryInitialized()).toBe(false);
  });
});

describe('OpenTelemetry Tracing Stub', () => {
  it('executes work inside startSpan and records duration and attributes', async () => {
    const result = await startSpan('db.findUser', async (span) => {
      span.setAttribute('user.id', 'u_123');
      const ctx = span.getContext();
      expect(ctx.traceId).toBeDefined();
      expect(ctx.spanId).toBeDefined();
      return 'user_found';
    });

    expect(result).toBe('user_found');
  });

  it('records exception when span callback throws', async () => {
    const testErr = new Error('Span failed');
    await expect(
      startSpan('cache.fetch', async () => {
        throw testErr;
      })
    ).rejects.toThrow('Span failed');
  });

  it('getTracer creates named tracer and executes spans', async () => {
    const tracer = getTracer('payment-service');
    const val = await tracer.startSpan('charge', async (span) => {
      expect(span.name).toBe('payment-service:charge');
      return 100;
    });
    expect(val).toBe(100);
  });
});

describe('Queue Trace Propagation', () => {
  it('propagates active traceId to enqueued job payload', async () => {
    migrate();
    const mockMailer = { send: vi.fn().mockResolvedValue(undefined) } as any;
    const queue = new JobQueue(mockMailer);

    let enqueuedId = 0;
    await runWithTraceContext({ traceId: 'job-trace-555' }, async () => {
      enqueuedId = await queue.enqueue('email.send', {
        to: 'test@example.com',
        subject: 'Trace Test',
        text: 'Hello',
        kind: 'welcome',
      });
    });

    expect(enqueuedId).toBeGreaterThan(0);
    const row = db.prepare('SELECT payload FROM jobs WHERE id = ?').get(enqueuedId) as { payload: string };
    const payload = JSON.parse(row.payload);
    expect(payload._traceId).toBe('job-trace-555');
  });
});
