import crypto from 'crypto';
import { getTraceContext, runWithTraceContext, logger } from './observability';
import { OTEL_EXPORTER_OTLP_ENDPOINT } from '../config/index';

// ============================================================================
// OpenTelemetry Tracing Interface / Zero-Overhead Stub.
//
// WHY: Distributed tracing allows tracking latency and failures across HTTP
// ingress, database queries, and async queues. This stub provides an API
// identical to OpenTelemetry's Tracer SDK:
//   const result = await startSpan('db.query', async (span) => { ... });
//
// In dev/test/production without an OTLP agent, it runs with zero overhead and
// correlates spans directly with our structured JSON logs and Sentry traceId.
// When OTEL_EXPORTER_OTLP_ENDPOINT is configured, it forwards span summaries.
// ============================================================================

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags?: number;
}

export class Span {
  readonly spanId: string;
  readonly traceId: string;
  readonly startTime: number;
  private endTime?: number;
  private attributes: Record<string, unknown>;
  private status: { code: 'ok' | 'error'; message?: string } = { code: 'ok' };

  constructor(
    readonly name: string,
    traceId?: string,
    initialAttributes: Record<string, unknown> = {}
  ) {
    this.spanId = crypto.randomUUID().slice(0, 16);
    this.traceId = traceId || getTraceContext()?.traceId || crypto.randomUUID();
    this.startTime = Date.now();
    this.attributes = { ...initialAttributes };
  }

  setAttribute(key: string, value: unknown): this {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attrs: Record<string, unknown>): this {
    Object.assign(this.attributes, attrs);
    return this;
  }

  setStatus(code: 'ok' | 'error', message?: string): this {
    this.status = { code, message };
    return this;
  }

  recordException(err: Error): this {
    this.status = { code: 'error', message: err.message };
    this.attributes['error.name'] = err.name;
    this.attributes['error.message'] = err.message;
    this.attributes['error.stack'] = err.stack;
    return this;
  }

  end(): void {
    if (this.endTime) return;
    this.endTime = Date.now();
    const durationMs = this.endTime - this.startTime;

    if (this.status.code === 'error') {
      logger.warn(`[otel:span] ${this.name} failed`, {
        traceId: this.traceId,
        spanId: this.spanId,
        durationMs,
        status: this.status,
        ...this.attributes,
      });
    } else {
      logger.debug(`[otel:span] ${this.name}`, {
        traceId: this.traceId,
        spanId: this.spanId,
        durationMs,
        status: this.status,
        ...this.attributes,
      });
    }

    // Optional fire-and-forget push to OTLP collector if endpoint configured
    if (OTEL_EXPORTER_OTLP_ENDPOINT) {
      void fetch(`${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceSpans: [
            {
              scopeSpans: [
                {
                  spans: [
                    {
                      traceId: this.traceId,
                      spanId: this.spanId,
                      name: this.name,
                      startTimeUnixNano: this.startTime * 1_000_000,
                      endTimeUnixNano: this.endTime * 1_000_000,
                      attributes: Object.entries(this.attributes).map(([key, val]) => ({
                        key,
                        value: { stringValue: String(val) },
                      })),
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }).catch(() => {});
    }
  }

  getContext(): SpanContext {
    return { traceId: this.traceId, spanId: this.spanId };
  }
}

/**
 * Runs a block of work inside a named OpenTelemetry span.
 * Correlates automatically with active trace context and logs execution timing.
 */
export async function startSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attributes?: Record<string, unknown>
): Promise<T> {
  const activeCtx = getTraceContext();
  const traceId = activeCtx?.traceId || crypto.randomUUID();
  const span = new Span(name, traceId, attributes);

  return runWithTraceContext({ traceId, requestId: activeCtx?.requestId }, async () => {
    try {
      const result = await fn(span);
      span.setStatus('ok');
      return result;
    } catch (err) {
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Returns a lightweight tracer instance.
 */
export function getTracer(name = 'default') {
  return {
    name,
    startSpan: <T>(spanName: string, fn: (span: Span) => Promise<T> | T, attrs?: Record<string, unknown>) =>
      startSpan(`${name}:${spanName}`, fn, attrs),
  };
}
