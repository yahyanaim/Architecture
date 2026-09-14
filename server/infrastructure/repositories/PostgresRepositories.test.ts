import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { PgUserRepository } from './PgUserRepository';
import { PgBillingRepository } from './PgBillingRepository';
import { PgMembershipRepository } from './PgMembershipRepository';
import { PgTokenStore } from './PgTokenStore';
import { PgOutboxRepository } from './PgOutboxRepository';
import { PostgresExecutor } from '../pg';
import { User, UserRole } from '../../domain/entities/User';
import { Organization } from '../../domain/entities/Organization';
import { Subscription, Plan } from '../../domain/entities/Subscription';
import { Membership } from '../../domain/entities/Membership';
import { OutboxEvent } from '../../domain/entities/OutboxEvent';
import { migratePg } from '../db/migratePg';
import { DATABASE_URL } from '../../config/index';

const { Pool } = pg;

describe('Postgres Repositories', () => {
  describe('PgUserRepository', () => {
    it('findById maps database row to User entity', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'u-1',
              name: 'Alice',
              email: 'alice@example.com',
              password: 'hashedpassword',
              org_id: 'org-1',
              created_at: new Date('2026-01-01T00:00:00Z'),
              is_active: true,
              role: 'admin',
              failed_attempts: 0,
              locked_until: null,
              email_verified_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      };

      const repo = new PgUserRepository(mockDb);
      const user = await repo.findById('u-1');

      expect(user).toBeInstanceOf(User);
      expect(user?.id).toBe('u-1');
      expect(user?.name).toBe('Alice');
      expect(user?.email).toBe('alice@example.com');
      expect(user?.orgId).toBe('org-1');
      expect(user?.role).toBe('admin');
      expect(user?.isActive).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id = $1'),
        ['u-1']
      );
    });

    it('findByEmail sanitizes email and passes to query', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };
      const repo = new PgUserRepository(mockDb);
      await repo.findByEmail('Alice@Example.COM');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE email = $1'),
        ['alice@example.com']
      );
    });

    it('save sends parameterized UPSERT statement', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      };
      const repo = new PgUserRepository(mockDb);
      const user = new User(
        'u-2',
        'Bob',
        'bob@example.com',
        'secret',
        new Date('2026-01-02T00:00:00Z'),
        true,
        'user',
        1,
        null,
        'org-2',
        null
      );

      await repo.save(user);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining(['u-2', 'Bob', 'bob@example.com', 'secret', 'org-2'])
      );
    });

    it('hasUsers returns boolean based on row count', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({ rows: [{ count: '3' }] }),
      };
      const repo = new PgUserRepository(mockDb);
      const has = await repo.hasUsers();
      expect(has).toBe(true);
    });
  });

  describe('PgBillingRepository', () => {
    it('findById maps row to Organization entity', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'org-1',
              name: 'Acme Corp',
              slug: 'acme-corp',
              plan: 'pro',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      };

      const repo = new PgBillingRepository(mockDb);
      const org = await repo.findById('org-1');

      expect(org).toBeInstanceOf(Organization);
      expect(org?.name).toBe('Acme Corp');
      expect(org?.plan).toBe('pro');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM organizations WHERE id = $1'),
        ['org-1']
      );
    });

    it('recordWebhookEvent executes idempotent insert', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      };
      const repo = new PgBillingRepository(mockDb);
      const recorded = await repo.recordWebhookEvent('evt_123', 'invoice.paid');
      expect(recorded).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhook_events'),
        expect.arrayContaining(['evt_123', 'invoice.paid'])
      );
    });

    it('findByOrgId maps row to Subscription entity', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              org_id: 'org-1',
              plan: 'enterprise',
              status: 'active',
              provider: 'stripe',
              provider_ref: 'sub_123',
              customer_ref: 'cus_123',
              grace_until: null,
              current_period_end: '2026-12-31T00:00:00Z',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      };

      const repo = new PgBillingRepository(mockDb);
      const sub = await repo.findByOrgId('org-1');

      expect(sub).toBeInstanceOf(Subscription);
      expect(sub?.plan).toBe('enterprise');
      expect(sub?.providerRef).toBe('sub_123');
    });
  });

  describe('PgMembershipRepository', () => {
    it('findByUserAndOrg retrieves and maps membership', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'mem-1',
              user_id: 'u-1',
              org_id: 'org-1',
              role: 'admin',
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      };

      const repo = new PgMembershipRepository(mockDb);
      const m = await repo.findByUserAndOrg('u-1', 'org-1');

      expect(m).toBeInstanceOf(Membership);
      expect(m?.id).toBe('mem-1');
      expect(m?.role).toBe('admin');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM memberships WHERE user_id = $1 AND org_id = $2'),
        ['u-1', 'org-1']
      );
    });

    it('save sends parameterized UPSERT statement', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      };
      const repo = new PgMembershipRepository(mockDb);
      const mem = new Membership('mem-1', 'u-1', 'org-1', 'admin', new Date('2026-01-01T00:00:00Z'));

      await repo.save(mem);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memberships'),
        expect.arrayContaining(['mem-1', 'u-1', 'org-1', 'admin'])
      );
    });

    it('countAdminsByOrg returns scalar number', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({ rows: [{ n: '2' }] }),
      };
      const repo = new PgMembershipRepository(mockDb);
      const count = await repo.countAdminsByOrg('org-1');
      expect(count).toBe(2);
    });
  });

  describe('PgTokenStore', () => {
    it('createRefresh and findRefreshByHash map correctly', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] }) // INSERT
          .mockResolvedValueOnce({ // SELECT
            rows: [
              {
                id: 'tok-1',
                user_id: 'u-1',
                token_hash: 'hash123',
                expires_at: '2026-02-01T00:00:00Z',
                revoked_at: null,
                replaced_by: null,
                created_at: '2026-01-01T00:00:00Z',
                ip: '127.0.0.1',
              },
            ],
          }),
      };

      const store = new PgTokenStore(mockDb);
      const session = await store.createRefresh({
        userId: 'u-1',
        tokenHash: 'hash123',
        expiresAt: new Date('2026-02-01T00:00:00Z'),
        ip: '127.0.0.1',
      });

      expect(session.userId).toBe('u-1');
      expect(session.tokenHash).toBe('hash123');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.arrayContaining(['u-1', 'hash123'])
      );
    });

    it('consumeAuthToken atomically marks token as used', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'auth-1',
                user_id: 'u-1',
                type: 'verify_email',
                token_hash: 'authhash',
                expires_at: new Date(Date.now() + 60000).toISOString(),
                used_at: null,
                created_at: '2026-01-01T00:00:00Z',
                meta: '{"foo":"bar"}',
              },
            ],
          })
          .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
      };

      const store = new PgTokenStore(mockDb);
      const token = await store.consumeAuthToken('authhash', 'verify');

      expect(token).not.toBeNull();
      expect(token?.userId).toBe('u-1');
      expect(token?.meta).toEqual({ foo: 'bar' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_tokens SET used_at = $1 WHERE id = $2 AND used_at IS NULL'),
        expect.anything()
      );
    });
  });

  describe('PgOutboxRepository', () => {
    it('save sends UPSERT for outbox event', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      };

      const repo = new PgOutboxRepository(mockDb);
      const event = new OutboxEvent(
        'evt-1',
        'User',
        'u-1',
        'user.created',
        { email: 'test@example.com' },
        'pending',
        0,
        null,
        new Date('2026-01-01T00:00:00Z'),
        null
      );

      await repo.save(event);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO outbox_events'),
        expect.arrayContaining(['evt-1', 'User', 'u-1', 'user.created'])
      );
    });

    it('fetchPending retrieves events ordered by created_at', async () => {
      const mockDb: PostgresExecutor = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'evt-1',
              aggregate_type: 'User',
              aggregate_id: 'u-1',
              event_type: 'user.created',
              payload: '{"email":"test@example.com"}',
              status: 'pending',
              retry_count: 0,
              last_error: null,
              created_at: '2026-01-01T00:00:00Z',
              published_at: null,
            },
          ],
        }),
      };

      const repo = new PgOutboxRepository(mockDb);
      const pending = await repo.fetchPending(10);

      expect(pending).toHaveLength(1);
      expect(pending[0]!.id).toBe('evt-1');
      expect(pending[0]!.payload).toEqual({ email: 'test@example.com' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM outbox_events WHERE status = 'pending'"),
        [10]
      );
    });
  });

  describe('migratePg', () => {
    it('creates schema_migrations and runs pending migrations in transaction', async () => {
      const executedQueries: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation(async (text: string, params?: any[]) => {
          executedQueries.push(text);
          if (text.includes('SELECT version FROM schema_migrations')) {
            return { rows: [{ version: '001_init' }] }; // simulate 001 already applied
          }
          if (text.includes('SELECT id FROM organizations WHERE slug = $1')) {
            return { rows: [{ id: 'default-org-id' }] };
          }
          if (text.includes('information_schema.tables')) {
            return { rows: [{ exists: false }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as pg.Pool;

      await migratePg(mockPool);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
      );
      expect(executedQueries.some((q) => q.includes('BEGIN'))).toBe(true);
      expect(executedQueries.some((q) => q.includes('COMMIT'))).toBe(true);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // Isolated live integration tests — activated when a PostgreSQL database is reachable
  const liveDbUrl = DATABASE_URL.includes('postgres') ? DATABASE_URL : undefined;
  const describeLive = liveDbUrl ? describe : describe.skip;

  describeLive('PostgreSQL Live Integration (isolated DB)', () => {
    let testPool: pg.Pool;

    beforeAll(async () => {
      testPool = new Pool({ connectionString: liveDbUrl });
      await migratePg(testPool);
    });

    afterAll(async () => {
      await testPool.end();
    });

    it('boots isolated database and performs end-to-end repository operations', async () => {
      const userRepo = new PgUserRepository({
        query: async (t, p) => {
          const res = await testPool.query(t, p);
          return { rows: res.rows, rowCount: res.rowCount };
        },
      });

      const testUser = new User(
        'pg-integration-test-user',
        'Integration User',
        'pgtest@example.com',
        'secret',
        new Date(),
        true,
        'user' as UserRole,
        0,
        null,
        'default',
        new Date()
      );

      await userRepo.save(testUser);
      const loaded = await userRepo.findById('pg-integration-test-user');

      expect(loaded).not.toBeNull();
      expect(loaded?.email).toBe('pgtest@example.com');

      await userRepo.delete('pg-integration-test-user');
      const deleted = await userRepo.findById('pg-integration-test-user');
      expect(deleted).toBeNull();
    });
  });
});
