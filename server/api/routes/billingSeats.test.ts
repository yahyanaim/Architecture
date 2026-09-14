import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';
import { migrate } from '../../infrastructure/db/migrate';
import {
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
  membershipRepository,
} from '../../infrastructure/repositories/SharedUserRepository';
import { AuthService } from '../../domain/services/AuthService';
import { Subscription } from '../../domain/entities/Subscription';
import crypto from 'crypto';
import { STRIPE_WEBHOOK_SECRET } from '../../config/index';

const authService = new AuthService(
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
  undefined,
  membershipRepository
);

function createStripeSignature(payload: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  return `t=${ts},v1=${signature}`;
}

describe('Billing: seats + metered + dunning integration', () => {
  beforeAll(() => {
    migrate(db);
  });

  it('exceeding seats blocks invite with upgrade flag', async () => {
    // 1. Register admin user
    const email = `admin.seats.${Date.now()}@example.com`;
    const reg = await authService.register('Admin Seats', email, 'Password123!');
    const token = reg.tokens.access;
    const orgId = reg.user.orgId;

    // Set subscription to 1 seat (already taken by the admin)
    const sub = await billingRepository.findByOrgId(orgId);
    expect(sub).not.toBeNull();
    sub!.seats = 1;
    await billingRepository.save(sub!);

    // Attempt to invite member - should fail because seat limit is 1 and current members is 1
    const inviteRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Member Two',
        email: `member2.${Date.now()}@example.com`,
      });

    expect(inviteRes.status).toBe(403);
    expect(inviteRes.body.code).toBe('upgrade_required');
    expect(inviteRes.body.reason).toBe('seat_limit_exceeded');
    expect(inviteRes.body.seats).toBe(1);
    expect(inviteRes.body.currentSeats).toBe(1);
  });

  it('Stripe test webhook updates seats and unblocks member invites', async () => {
    const email = `admin.webhook.${Date.now()}@example.com`;
    const reg = await authService.register('Webhook Admin', email, 'Password123!');
    reg.user.role = 'admin';
    await userRepository.save(reg.user);
    const token = reg.tokens.access;
    const orgId = reg.user.orgId;

    const subId = `sub_stripe_${Date.now()}`;
    const sub = await billingRepository.findByOrgId(orgId);
    sub!.provider = 'stripe';
    sub!.providerRef = subId;
    sub!.seats = 1;
    await billingRepository.save(sub!);

    // Stripe webhook customer.subscription.updated with quantity: 10
    const webhookSecret = STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: subId,
          status: 'active',
          items: {
            data: [
              {
                quantity: 10,
                price: { id: 'price_pro' },
              },
            ],
          },
        },
      },
    });

    const signature = createStripeSignature(payload, webhookSecret);

    const webhookRes = await request(app)
      .post('/api/billing/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(webhookRes.status).toBe(200);

    // Verify sub now has 10 seats
    const updatedSub = await billingRepository.findByOrgId(orgId);
    expect(updatedSub?.seats).toBe(10);

    // Now invite member - should succeed!
    const inviteRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Member After Upgrade',
        email: `member.upgraded.${Date.now()}@example.com`,
      });

    expect(inviteRes.status).toBe(201);
  });

  it('grace expiry blocks member invite and access', async () => {
    const email = `admin.grace.${Date.now()}@example.com`;
    const reg = await authService.register('Grace Admin', email, 'Password123!');
    reg.user.role = 'admin';
    await userRepository.save(reg.user);
    const token = reg.tokens.access;
    const orgId = reg.user.orgId;

    // Set subscription to past_due with expired grace
    const sub = await billingRepository.findByOrgId(orgId);
    sub!.status = 'past_due';
    sub!.graceUntil = new Date(Date.now() - 1000); // expired
    sub!.seats = 10;
    await billingRepository.save(sub!);

    const inviteRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Member Blocked',
        email: `member.grace.${Date.now()}@example.com`,
      });

    expect(inviteRes.status).toBe(403);
    expect(inviteRes.body.code).toBe('upgrade_required');
  });

  it('allows updating seats directly via POST /api/v1/billing/seats', async () => {
    const email = `admin.slider.${Date.now()}@example.com`;
    const reg = await authService.register('Slider Admin', email, 'Password123!');
    const token = reg.tokens.access;

    const res = await request(app)
      .post('/api/v1/billing/seats')
      .set('Authorization', `Bearer ${token}`)
      .send({ seats: 8 });

    expect(res.status).toBe(200);
    expect(res.body.seats).toBe(8);
  });

  it('lists invoices and records metered usage', async () => {
    const email = `admin.metered.${Date.now()}@example.com`;
    const reg = await authService.register('Metered Admin', email, 'Password123!');
    const token = reg.tokens.access;

    // Invoices list
    const invoicesRes = await request(app)
      .get('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(invoicesRes.status).toBe(200);
    expect(Array.isArray(invoicesRes.body)).toBe(true);

    // Record metered usage event
    const usageRes = await request(app)
      .post('/api/v1/billing/usage')
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventName: 'api_calls',
        quantity: 50,
      });

    expect(usageRes.status).toBe(201);
    expect(usageRes.body.eventName).toBe('api_calls');
    expect(usageRes.body.quantity).toBe(50);
  });
});
