import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyWebhookSignature, priceToPlan } from './billing';

// Signature verification is pure crypto: fully testable without Stripe.
function sign(payload: string, secret: string, ts: number): string {
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  return `t=${ts},v1=${sig}`;
}

describe('stripe webhook signature', () => {
  const secret = 'whsec_test';
  const payload = JSON.stringify({ id: 'evt_1', type: 'x' });

  it('accepts a fresh valid signature', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(payload, sign(payload, secret, ts), secret)).toBe(true);
  });

  it('rejects tampered payloads', () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(payload, secret, ts);
    expect(verifyWebhookSignature(payload + 'x', header, secret)).toBe(false);
  });

  it('rejects wrong secrets and stale timestamps', () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(payload, secret, ts);
    expect(verifyWebhookSignature(payload, header, 'wrong')).toBe(false);
    const old = sign(payload, secret, ts - 3600);
    expect(verifyWebhookSignature(payload, old, secret)).toBe(false);
  });

  it('rejects missing headers', () => {
    expect(verifyWebhookSignature(payload, undefined, secret)).toBe(false);
  });
});

describe('priceToPlan', () => {
  const map = { pro: 'price_pro_123', enterprise: 'price_ent_123' };
  it('maps configured prices', () => {
    expect(priceToPlan('price_pro_123', map)).toBe('pro');
    expect(priceToPlan('price_ent_123', map)).toBe('enterprise');
  });
  it('returns null for unknown/missing prices (never blind-upgrade)', () => {
    expect(priceToPlan('price_evil', map)).toBeNull();
    expect(priceToPlan(undefined, map)).toBeNull();
  });
});
