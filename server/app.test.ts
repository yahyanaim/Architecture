import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app';

describe('API Health Check', () => {
  it('GET /api/health returns 200 OK', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });
});
