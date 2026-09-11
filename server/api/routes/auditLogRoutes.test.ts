import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';
import { migrate } from '../../infrastructure/db/migrate';
import { userRepository, orgRepository, billingRepository, tokenStore, membershipRepository } from '../../infrastructure/repositories/SharedUserRepository';
import { AuthService } from '../../domain/services/AuthService';
import { audit } from '../../infrastructure/audit';

describe('Admin Audit Log Viewer & Health Probes', () => {
  let authService: AuthService;
  let adminToken: string;
  let adminOrgId: string;
  let userToken: string;

  beforeEach(async () => {
    migrate(db);
    db.prepare('DELETE FROM audit_logs').run();
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

    // First user is instance admin
    const adminReg = await authService.register('Admin User', 'admin@example.com', 'AdminPass123!');
    adminToken = adminReg.tokens.access;
    adminOrgId = adminReg.org.id;

    // Second user is regular user
    const userReg = await authService.register('Regular User', 'user@example.com', 'UserPass123!');
    userToken = userReg.tokens.access;

    // Generate some audit events
    audit('settings.updated', adminReg.user.id, { orgId: adminOrgId, theme: 'dark' });
    audit('api_key.created', adminReg.user.id, { orgId: adminOrgId, keyName: 'Prod' });
  });

  describe('GET /api/admin/audit-logs', () => {
    it('allows admin to query audit logs with pagination and filters', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBeGreaterThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.entries[0]).toHaveProperty('event');
      expect(res.body.entries[0]).toHaveProperty('actorId');
      expect(res.body.entries[0]).toHaveProperty('timestamp');
    });

    it('filters audit logs by event type', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?event=settings.updated')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBe(1);
      expect(res.body.entries[0].event).toBe('settings.updated');
    });

    it('forbids non-admin users from accessing audit logs', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Cloud Health Probes', () => {
    it('GET /api/health/live returns 200 alive with process uptime', async () => {
      const res = await request(app).get('/api/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });

    it('GET /api/health/ready returns 200 ready with database and memory health checks', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database).toBe('healthy');
      expect(typeof res.body.checks.dbLatencyMs).toBe('number');
      expect(res.body.checks.memory).toBeDefined();
    });
  });
});
