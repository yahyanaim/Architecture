import { describe, it, expect, beforeEach } from 'vitest';
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

describe('Multi-Org User Management & Workspace Invites', () => {
  let authService: AuthService;

  beforeEach(async () => {
    migrate(db);
    db.prepare('DELETE FROM memberships').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM organizations').run();

    authService = new AuthService(
      userRepository,
      orgRepository,
      billingRepository,
      tokenStore,
      undefined,
      membershipRepository
    );
  });

  it('invites an existing user into a second workspace, allows switching, and preserves account on removal', async () => {
    // 1. Owner A registers -> creates Workspace A
    const regA = await authService.register('Owner A', 'ownerA@example.com', 'Password123!');
    const tokenA = regA.tokens.access;
    const orgAId = regA.org.id;

    // 2. User B registers independently -> creates Workspace B
    const regB = await authService.register('User B', 'userB@example.com', 'Password123!');
    const tokenB = regB.tokens.access;
    const orgBId = regB.org.id;

    // Initially User B only has 1 workspace (Workspace B)
    const initialWorkspacesB = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(initialWorkspacesB.status).toBe(200);
    expect(initialWorkspacesB.body.length).toBe(1);
    expect(initialWorkspacesB.body[0].id).toBe(orgBId);

    // 3. Owner A invites existing User B into Workspace A
    const inviteRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'User B',
        email: 'userB@example.com',
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.email).toBe('userb@example.com');
    expect(inviteRes.body.id).toBe(regB.user.id);

    // 4. User B now lists their workspaces -> sees BOTH Workspace B and Workspace A!
    const updatedWorkspacesB = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(updatedWorkspacesB.status).toBe(200);
    expect(updatedWorkspacesB.body.length).toBe(2);
    const orgIds = updatedWorkspacesB.body.map((w: any) => w.id);
    expect(orgIds).toContain(orgAId);
    expect(orgIds).toContain(orgBId);

    // 5. User B switches to Workspace A using X-Organization-Id
    const switchRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Organization-Id', orgAId);

    expect(switchRes.status).toBe(200);
    const current = switchRes.body.find((w: any) => w.id === orgAId);
    expect(current.isCurrent).toBe(true);
    expect(current.role).toBe('user');

    // 6. Inviting User B into Workspace A a second time is rejected with clear error
    const duplicateRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'User B',
        email: 'userB@example.com',
      });

    expect(duplicateRes.status).toBe(400);

    // 7. Owner A lists users in Workspace A -> sees Owner A and User B
    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(2);
    const userEmails = listRes.body.map((u: any) => u.email);
    expect(userEmails).toContain('ownera@example.com');
    expect(userEmails).toContain('userb@example.com');

    // 8. Owner A removes User B from Workspace A
    const removeRes = await request(app)
      .delete(`/api/users/${regB.user.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(removeRes.status).toBe(204);

    // 9. User B's account is NOT destroyed — User B still has Workspace B
    const finalWorkspacesB = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(finalWorkspacesB.status).toBe(200);
    expect(finalWorkspacesB.body.length).toBe(1);
    expect(finalWorkspacesB.body[0].id).toBe(orgBId);

    // User B can no longer access Workspace A
    const unauthorizedSwitch = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Organization-Id', orgAId);

    expect(unauthorizedSwitch.status).toBe(403);
  });
});
