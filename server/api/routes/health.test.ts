import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';

describe('Health Probes API (/health/live & /health/ready)', () => {
  it('GET /api/v1/health/live returns 200 alive', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'alive');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/health/ready returns 200 ready when database is reachable', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body.checks).toHaveProperty('database', 'healthy');
    expect(res.body.checks).toHaveProperty('dbLatencyMs');
    expect(typeof res.body.checks.dbLatencyMs).toBe('number');
    expect(res.body.checks.memory).toHaveProperty('heapUsedMb');
  });

  it('GET /api/v1/health/ready returns 503 unhealthy when database query fails', async () => {
    const prepareSpy = vi.spyOn(db, 'prepare').mockImplementation(() => {
      throw new Error('Database connection terminated');
    });

    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('status', 'unhealthy');
    expect(res.body).toHaveProperty('error', 'Database connection terminated');

    prepareSpy.mockRestore();
  });

  it('GET /api/v1/health returns legacy 200 ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('Responses carry x-request-id and x-trace-id headers', async () => {
    const res = await request(app)
      .get('/api/v1/health/live')
      .set('x-request-id', 'custom-req-id-123')
      .set('x-trace-id', 'custom-trace-id-456');

    expect(res.headers['x-request-id']).toBe('custom-req-id-123');
    expect(res.headers['x-trace-id']).toBe('custom-trace-id-456');
  });
});
