import crypto from 'crypto';

// ============================================================================
// Stripe integration WITHOUT the SDK (fetch + node:crypto only).
// Why no `stripe` package: webhook verification is just HMAC-SHA256 and the
// three calls we need are plain REST — a 200-line dependency surface isn't
// justified. If call volume grows, swap this file for the SDK behind the
// same method shapes; callers (BillingService, routes) stay untouched.
// ============================================================================

export interface StripePriceMap {
  pro?: string;
  enterprise?: string;
}

export class StripeError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function basicAuth(secret: string): string {
  return 'Basic ' + Buffer.from(secret + ':').toString('base64');
}

async function stripeFetch(secret: string, method: string, path: string, params?: Record<string, string>): Promise<any> {
  const url = 'https://api.stripe.com' + path;
  const init: RequestInit = {
    method,
    headers: { Authorization: basicAuth(secret) },
  };
  if (params) {
    init.headers = { ...init.headers, 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams(params).toString();
  }
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new StripeError(res.status, body?.error?.code ?? 'stripe_error', body?.error?.message ?? 'Stripe request failed');
  }
  return body;
}

/**
 * Verifies a Stripe webhook signature header (`t=...,v1=...[,v1=...]`).
 * SECURITY: HMAC over `${timestamp}.${rawBody}` with timing-safe compare +
 * timestamp tolerance (default 5 min) against replay. Raw body bytes must be
 * used — hence the route mounts `express.raw()` BEFORE `express.json()`.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string, header: string | undefined, secret: string, toleranceSec = 300
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim());
  const ts = parts.find((p) => p.startsWith('t='))?.slice(2);
  const sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!ts || sigs.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(ts, 10)) > toleranceSec) return false;

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(ts + '.').update(payload).digest();
  return sigs.some((s) => {
    try {
      const sig = Buffer.from(s, 'hex');
      return sig.length === expected.length && crypto.timingSafeEqual(sig, expected);
    } catch {
      return false;
    }
  });
}

export interface CheckoutInput {
  orgId: string;
  plan: 'pro' | 'enterprise';
  priceId: string;
  customerEmail: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
}

export class StripeClient {
  constructor(private readonly secretKey: string) {}

  get enabled(): boolean {
    return this.secretKey.length > 0;
  }

  /** Creates a subscription Checkout Session; metadata ties it back to us. */
  async createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }> {
    const params: Record<string, string> = {
      mode: 'subscription',
      'line_items[0][price]': input.priceId,
      'line_items[0][quantity]': '1',
      client_reference_id: input.orgId,
      'metadata[orgId]': input.orgId,
      'metadata[plan]': input.plan,
      'subscription_data[metadata][orgId]': input.orgId,
      'subscription_data[metadata][plan]': input.plan,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    };
    if (input.customerId) params.customer = input.customerId;
    else params.customer_email = input.customerEmail;
    const session = await stripeFetch(this.secretKey, 'POST', '/v1/checkout/sessions', params);
    return { id: session.id, url: session.url };
  }

  /** Customer portal for self-serve upgrades/cancels/payment updates. */
  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const session = await stripeFetch(this.secretKey, 'POST', '/v1/billing_portal/sessions', {
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  /** Fetches a subscription (used when the webhook object lacks metadata). */
  async getSubscription(subscriptionId: string): Promise<any> {
    return stripeFetch(this.secretKey, 'GET', `/v1/subscriptions/${subscriptionId}`);
  }
}

/** Maps a Stripe price id to our plan via env-configured price ids. */
export function priceToPlan(priceId: string | undefined, map: StripePriceMap): 'pro' | 'enterprise' | null {
  if (!priceId) return null;
  if (map.enterprise && priceId === map.enterprise) return 'enterprise';
  if (map.pro && priceId === map.pro) return 'pro';
  return null;
}
