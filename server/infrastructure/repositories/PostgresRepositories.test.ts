import { describe, it, expect, vi } from 'vitest';
import { PostgresUserRepository, PostgresExecutor } from './PostgresUserRepository';
import { PostgresBillingRepository } from './PostgresBillingRepository';
import { User, UserRole } from '../../domain/entities/User';
import { Organization } from '../../domain/entities/Organization';
import { Subscription, Plan } from '../../domain/entities/Subscription';

describe('Postgres Repositories', () => {
  describe('PostgresUserRepository', () => {
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

      const repo = new PostgresUserRepository(mockDb);
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
      const repo = new PostgresUserRepository(mockDb);
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
      const repo = new PostgresUserRepository(mockDb);
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
      const repo = new PostgresUserRepository(mockDb);
      const has = await repo.hasUsers();
      expect(has).toBe(true);
    });
  });

  describe('PostgresBillingRepository', () => {
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

      const repo = new PostgresBillingRepository(mockDb);
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
      const repo = new PostgresBillingRepository(mockDb);
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

      const repo = new PostgresBillingRepository(mockDb);
      const sub = await repo.findByOrgId('org-1');

      expect(sub).toBeInstanceOf(Subscription);
      expect(sub?.plan).toBe('enterprise');
      expect(sub?.providerRef).toBe('sub_123');
    });
  });
});
