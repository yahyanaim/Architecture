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
import { Organization } from '../../domain/entities/Organization';
import { Membership } from '../../domain/entities/Membership';

const authService = new AuthService(
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
  undefined,
  membershipRepository
);

describe('Workspace Routes & Multi-Tenancy Switching', () => {
  beforeAll(() => {
    migrate(db);
  });

  it('allows a user to list their workspaces and create a new workspace', async () => {
    const reg = await authService.register('Alice Multi', 'alice.multi@example.com', 'SecurePass123!');
    const token = reg.tokens.access;

    // List workspaces
    const listRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body[0].role).toBe('admin');

    // Create another workspace
    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme Secondary Corp' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Acme Secondary Corp');
    expect(createRes.body.role).toBe('admin');

    // List again — should have both
    const updatedList = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${token}`);

    expect(updatedList.body.length).toBeGreaterThanOrEqual(2);
    const orgIds = updatedList.body.map((w: any) => w.id);
    expect(orgIds).toContain(createRes.body.id);
  });

  it('enforces tenant switching isolation with X-Organization-Id', async () => {
    const user1 = await authService.register('Bob Org', 'bob.org@example.com', 'SecurePass123!');
    const user2 = await authService.register('Charlie Other', 'charlie.other@example.com', 'SecurePass123!');

    // User 1 tries to access User 2's workspace using X-Organization-Id header
    const forbiddenRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${user1.tokens.access}`)
      .set('X-Organization-Id', user2.org.id);

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.message).toMatch(/not a member of this workspace/i);

    // Now invite/add User 1 to User 2's organization as a member
    const newMembership = Membership.create(user1.user.id, user2.org.id, 'user');
    await membershipRepository.save(newMembership);

    // Now User 1 can switch to User 2's organization context!
    const allowedRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${user1.tokens.access}`)
      .set('X-Organization-Id', user2.org.id);

    expect(allowedRes.status).toBe(200);
  });
});
