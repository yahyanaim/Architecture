import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import express from 'express';
import crypto from 'crypto';
import { app } from '../../app';
import { db } from '../database';
import { migrate } from '../db/migrate';
import {
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
  membershipRepository,
  webhookRepository,
  webhookDispatcher,
  jobQueue,
  outboxRelay,
  outboxRepository,
} from '../repositories/SharedUserRepository';
import { AuthService } from '../../domain/services/AuthService';
import { OutboxEvent } from '../../domain/entities/OutboxEvent';

describe('Outbound Webhooks (via Transactional Outbox)', () => {
  let authService: AuthService;
  let tokenA: string;
  let orgAId: string;
  let tokenB: string;
  let orgBId: string;

  let testServer: http.Server;
  let testPort: number;
  let receivedRequests: Array<{
    headers: http.IncomingHttpHeaders;
    body: any;
  }> = [];
  let simulateFailure = false;

  beforeAll(async () => {
    migrate(db);

    authService = new AuthService(
      userRepository,
      orgRepository,
      billingRepository,
      tokenStore,
      undefined,
      membershipRepository
    );

    // Register Org A Admin
    const regA = await authService.register('Admin A', `admin-a-${Date.now()}@example.com`, 'Password123!');
    tokenA = regA.tokens.access;
    orgAId = regA.org.id;

    // Register Org B Admin
    const regB = await authService.register('Admin B', `admin-b-${Date.now()}@example.com`, 'Password123!');
    tokenB = regB.tokens.access;
    orgBId = regB.org.id;

    // Setup local receiver server for webhook testing
    const receiverApp = express();
    receiverApp.use(express.json());
    receiverApp.post('/test-webhook', (req, res) => {
      receivedRequests.push({ headers: req.headers, body: req.body });
      if (simulateFailure) {
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.status(200).json({ received: true });
      }
    });

    await new Promise<void>((resolve) => {
      testServer = receiverApp.listen(0, () => {
        const addr = testServer.address() as any;
        testPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      testServer?.close(() => resolve());
    });
  });

  it('allows creating webhook endpoints scoped to the workspace', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        url: `http://localhost:${testPort}/test-webhook`,
        description: 'Customer Alert Endpoint',
        events: ['user.*', 'billing.*'],
        secret: 'whsec_mysecretkey1234567890',
      });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe(`http://localhost:${testPort}/test-webhook`);
    expect(res.body.orgId).toBe(orgAId);
    expect(res.body.secret).toBe('whsec_mysecretkey1234567890');
    expect(res.body.events).toEqual(['user.*', 'billing.*']);
  });

  it('enforces tenant isolation: Org B cannot view, ping, or delete Org A endpoint', async () => {
    // Org A lists endpoints
    const listA = await request(app)
      .get('/api/v1/webhooks')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listA.status).toBe(200);
    const endpoints = listA.body.data || listA.body;
    expect(endpoints.length).toBeGreaterThanOrEqual(1);
    const endpointAId = endpoints[0].id;

    // Org B attempts to get Org A's endpoint
    const getB = await request(app)
      .get(`/api/v1/webhooks/${endpointAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getB.status).toBe(404);

    // Org B attempts to test ping Org A's endpoint
    const pingB = await request(app)
      .post(`/api/v1/webhooks/${endpointAId}/test`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(pingB.status).toBe(404);

    // Org B attempts to delete Org A's endpoint
    const delB = await request(app)
      .delete(`/api/v1/webhooks/${endpointAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(delB.status).toBe(404);

    // Org B listing shows 0 endpoints
    const listB = await request(app)
      .get('/api/v1/webhooks')
      .set('Authorization', `Bearer ${tokenB}`);
    const endpointsB = listB.body.data || listB.body;
    expect(endpointsB.length).toBe(0);
  });

  it('delivers signed test ping with HMAC-SHA256 signature', async () => {
    receivedRequests = [];
    simulateFailure = false;

    const listA = await request(app)
      .get('/api/v1/webhooks')
      .set('Authorization', `Bearer ${tokenA}`);
    const endpoints = listA.body.data || listA.body;
    const endpointA = endpoints[0];

    const pingRes = await request(app)
      .post(`/api/v1/webhooks/${endpointA.id}/test`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(pingRes.status).toBe(200);
    expect(pingRes.body.success).toBe(true);
    expect(pingRes.body.statusCode).toBe(200);
    expect(pingRes.body.signature).toBeDefined();

    // Verify received request on test server
    expect(receivedRequests.length).toBe(1);
    const received = receivedRequests[0]!;
    expect(received.headers['x-webhook-event']).toBe('ping');
    expect(received.body.event).toBe('ping');

    // Verify HMAC-SHA256 signature
    const sigHeader = received.headers['x-webhook-signature'] as string;
    expect(sigHeader).toBeDefined();
    // Header format: t=<timestamp>,v1=<signature>
    const match = /t=(\d+),v1=([a-f0-9]+)/.exec(sigHeader);
    expect(match).not.toBeNull();
    const timestamp = match![1];
    const receivedSig = match![2];

    const expectedSig = crypto
      .createHmac('sha256', endpointA.secret)
      .update(`${timestamp}.${JSON.stringify(received.body)}`)
      .digest('hex');

    expect(receivedSig).toBe(expectedSig);
  });

  it('dispatches webhooks on domain events via outbox and job queue', async () => {
    receivedRequests = [];
    simulateFailure = false;

    // 1. Emit an outbox event for Org A
    const outboxEvent = OutboxEvent.create('user', 'u-test-999', 'user.registered', {
      email: 'newuser@example.com',
      orgId: orgAId,
    });
    await outboxRepository.save(outboxEvent);

    // 2. Process outbox relay -> enqueues 'webhook.deliver' job
    const processedOutbox = await outboxRelay.processPending();
    expect(processedOutbox).toBeGreaterThanOrEqual(1);

    // 3. Process job queue -> executes 'webhook.deliver'
    const processedJobs = await jobQueue.processDue();
    expect(processedJobs).toBeGreaterThanOrEqual(1);

    // 4. Verify test server received the event
    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0]!;
    expect(req.headers['x-webhook-event']).toBe('user.registered');
    expect(req.body.email).toBe('newuser@example.com');
  });

  it('retries failing endpoint and dead-letters after max attempts', async () => {
    simulateFailure = true;

    // Create a new failing endpoint
    const epRes = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        url: `http://localhost:${testPort}/test-webhook`,
        description: 'Failing Endpoint',
        events: ['failing.*'],
      });
    const failingEp = epRes.body;

    // Directly enqueue a job with maxAttempts = 2 to verify dead-lettering fast
    const delivery = await webhookRepository.listDeliveries(orgAId, failingEp.id);
    const jobId = await jobQueue.enqueue(
      'webhook.deliver',
      {
        deliveryId: 'test-del-failure',
        endpointId: failingEp.id,
        orgId: orgAId,
        eventType: 'failing.event',
        payload: { attempt: 1 },
        secret: failingEp.secret,
        url: failingEp.url,
      },
      { maxAttempts: 2 }
    );

    // First attempt -> fails, scheduled for retry
    await jobQueue.processDue();
    let jobRow = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    expect(jobRow.attempts).toBe(1);
    expect(jobRow.status).toBe('queued');

    // Force run_at to past so it can be picked up immediately
    db.prepare("UPDATE jobs SET run_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(jobId);

    // Second attempt -> fails, reaches max_attempts (2) -> status becomes 'dead'
    await jobQueue.processDue();
    jobRow = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    expect(jobRow.attempts).toBe(2);
    expect(jobRow.status).toBe('dead');
    expect(jobRow.last_error).toContain('HTTP 500');
  });

  it('allows replaying failed deliveries', async () => {
    simulateFailure = false;
    receivedRequests = [];

    // Get an existing delivery from Org A
    const listA = await request(app)
      .get('/api/v1/webhooks')
      .set('Authorization', `Bearer ${tokenA}`);
    const endpoints = listA.body.data || listA.body;
    const targetEndpoint = endpoints.find((e: any) => e.description === 'Customer Alert Endpoint') || endpoints[0];

    const delRes = await request(app)
      .get(`/api/v1/webhooks/${targetEndpoint.id}/deliveries`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(delRes.status).toBe(200);
    const deliveries = delRes.body.data || delRes.body;
    expect(deliveries.length).toBeGreaterThan(0);
    const targetDelivery = deliveries[0];

    // Replay delivery
    const replayRes = await request(app)
      .post(`/api/v1/webhooks/deliveries/${targetDelivery.id}/replay`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.message).toContain('re-queued');

    // Process job queue
    const done = await jobQueue.processDue();
    expect(done).toBeGreaterThanOrEqual(1);

    // Verify request delivered to test server
    expect(receivedRequests.length).toBeGreaterThanOrEqual(1);
  });
});
