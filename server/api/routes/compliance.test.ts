import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../infrastructure/database';
import { migrate } from '../../infrastructure/db/migrate';
import { AuthService } from '../../domain/services/AuthService';
import { User } from '../../domain/entities/User';
import { audit } from '../../infrastructure/audit';
import { hardPurgeUser, hardPurgeDueUsers } from '../../infrastructure/queue';
import {
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
} from '../../infrastructure/repositories/SharedUserRepository';

describe('Compliance: GDPR Data Portability & Erasure (/api/v1/me)', () => {
  beforeAll(() => {
    migrate(db);
  });

  const authService = new AuthService(userRepository, orgRepository, billingRepository, tokenStore);
  let user: any;
  let token: string;
  let sessionCookies: string[];

  beforeEach(async () => {
    const email = `gdpr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const reg = await authService.register('GDPR Subject', email, 'SuperSecure123!');
    user = reg.user;
    token = reg.tokens.access;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'SuperSecure123!' });

    sessionCookies = (loginRes.headers['set-cookie'] as unknown as string[]) || [];

    // Insert an audit log event
    audit('user.login_attempt', user.id, { email: user.email, ip: '127.0.0.1', orgId: user.orgId });

    // Create an API key for this user
    db.prepare(`
      INSERT INTO api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      globalThis.crypto.randomUUID(),
      user.orgId,
      user.id,
      'Test Dev Key',
      'nex_live_abc',
      `hash_${globalThis.crypto.randomUUID()}`,
      JSON.stringify(['read', 'write']),
      new Date().toISOString()
    );
  });

  describe('GET /api/v1/me/export (Data Portability)', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app).get('/api/v1/me/export');
      expect(res.status).toBe(401);
    });

    it('returns complete JSON export containing all user PII, org, subs, keys, and audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/me/export')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toContain(`gdpr-export-${user.id}.json`);

      // 1. User PII
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.name).toBe('GDPR Subject');
      expect(res.body.user.role).toBe(user.role);

      // 2. Org
      expect(res.body.org).toBeDefined();
      expect(res.body.org.id).toBe(user.orgId);
      expect(res.body.org.plan).toBeDefined();

      // 3. Subscriptions
      expect(res.body.subs).toBeDefined();
      expect(res.body.subs.plan).toBe('free');

      // 4. API Keys
      expect(res.body.keys).toBeDefined();
      expect(Array.isArray(res.body.keys)).toBe(true);
      expect(res.body.keys.length).toBeGreaterThanOrEqual(1);
      expect(res.body.keys[0].name).toBe('Test Dev Key');
      expect(res.body.keys[0].keyPrefix).toBe('nex_live_abc');

      // 5. Audit Log Trail
      expect(res.body.audit).toBeDefined();
      expect(Array.isArray(res.body.audit)).toBe(true);
      expect(res.body.audit.length).toBeGreaterThanOrEqual(1);
      expect(res.body.audit.some((a: any) => a.event === 'user.login_attempt')).toBe(true);
    });
  });

  describe('DELETE /api/v1/me/purge (Right to Erasure & 30d Retention)', () => {
    it('requires authentication (401)', async () => {
      const res = await request(app).delete('/api/v1/me/purge');
      expect(res.status).toBe(401);
    });

    it('kills sessions, anonymizes audit logs, soft-deletes user, and enqueues hard purge job', async () => {
      // Execute purge via Bearer token
      const res = await request(app)
        .delete('/api/v1/me/purge')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.purgeDueAt).toBeDefined();

      // 1. Check cookies were cleared in response
      const setCookie = res.headers['set-cookie'] as string[] | undefined;
      if (setCookie) {
        expect(setCookie.some((c) => c.includes('access=;'))).toBe(true);
        expect(setCookie.some((c) => c.includes('refresh=;'))).toBe(true);
      }

      // 2. Refresh sessions are killed
      const remainingTokens = db.prepare('SELECT COUNT(*) as count FROM refresh_tokens WHERE user_id = ?').get(user.id) as { count: number };
      expect(remainingTokens.count).toBe(0);

      // 3. Audit trail is anonymized
      const userAuditLogs = db.prepare('SELECT * FROM audit_logs WHERE actor_id = ?').all(user.id) as any[];
      expect(userAuditLogs.length).toBe(0);

      const anonymizedLogs = db.prepare("SELECT * FROM audit_logs WHERE actor_id = 'anonymized'").all() as any[];
      expect(anonymizedLogs.length).toBeGreaterThanOrEqual(1);

      // Verify email was scrubbed in details
      for (const log of anonymizedLogs) {
        expect(log.details).not.toContain(user.email);
      }

      // 4. User is soft-deleted (isActive = 0, deleted_at and purge_due_at populated)
      const userRow = db.prepare('SELECT is_active, deleted_at, purge_due_at FROM users WHERE id = ?').get(user.id) as any;
      expect(userRow.is_active).toBe(0);
      expect(userRow.deleted_at).toBeDefined();
      expect(userRow.purge_due_at).toBeDefined();

      // 5. Subsequent request with old session token fails (403 Account disabled)
      const subsequentRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(subsequentRes.status).toBe(403);

      // 6. Hard purge job test: executing hardPurgeUser permanently deletes user and cascading records
      hardPurgeUser(user.id);
      const purgedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      expect(purgedUser).toBeUndefined();

      const purgedKeys = db.prepare('SELECT * FROM api_keys WHERE user_id = ?').all(user.id);
      expect(purgedKeys.length).toBe(0);
    });

    it('blocks sole admin from purging if other members exist in workspace', async () => {
      user.role = 'admin';
      await userRepository.save(user);

      const member = await User.create('Colleague Member', `colleague-${Date.now()}@example.com`, 'SuperPass123!', 'user');
      member.orgId = user.orgId;
      await userRepository.save(member);

      const res = await request(app)
        .delete('/api/v1/me/purge')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('sole admin');
    });
  });
});
