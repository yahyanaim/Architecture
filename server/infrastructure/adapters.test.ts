import { describe, it, expect, beforeAll } from 'vitest';
import { db } from './database';
import { migrate } from './db/migrate';
import { SqliteUserRepository } from './repositories/SqliteUserRepository';
import { SqliteTokenStore } from './repositories/SqliteTokenStore';
import { SqliteBillingRepository } from './repositories/SqliteBillingRepository';
import { User } from '../domain/entities/User';
import { Organization } from '../domain/entities/Organization';
import { Subscription } from '../domain/entities/Subscription';

// Integration tests against real SQLite (isolated `:memory:` DB under
// NODE_ENV=test — each test file gets its own instance). Proves the port
// contracts hold on the actual adapter, not just doubles.
describe('sqlite adapters', () => {
  beforeAll(() => {
    migrate(db);
  });

  it('users: save/find/scope-by-org round-trip', async () => {
    const billing = new SqliteBillingRepository();
    await billing.save(new Organization('org-a', 'A', 'a'));
    await billing.save(new Organization('org-b', 'B', 'b'));
    const users = new SqliteUserRepository();
    const a = await User.create('Ann', 'ann@example.com', 'Password1', 'user');
    a.orgId = 'org-a';
    await users.save(a);
    const b = await User.create('Bob', 'bob@example.com', 'Password1', 'user');
    b.orgId = 'org-b';
    await users.save(b);

    expect((await users.findByEmail('ann@example.com'))?.id).toBe(a.id);
    expect(await users.findByEmailAndOrg('ann@example.com', 'org-b')).toBeNull();
    expect((await users.findAllByOrg('org-a')).map((u) => u.email)).toEqual(['ann@example.com']);
    expect(await users.hasUsers()).toBe(true);
  });

  it('tokens: single-use consume is idempotent-safe', async () => {
    const store = new SqliteTokenStore();
    await store.createAuthToken({
      userId: null, type: 'verify', tokenHash: 'h1', expiresAt: new Date(Date.now() + 60_000), meta: {},
    });
    expect(await store.consumeAuthToken('h1', 'verify')).not.toBeNull();
    expect(await store.consumeAuthToken('h1', 'verify')).toBeNull(); // no double-spend
  });

  it('billing: org + subscription upsert round-trip', async () => {
    const billing = new SqliteBillingRepository();
    await billing.save(new Organization('o1', 'Acme', 'acme'));
    await billing.save(new Subscription('o1', 'free', 'trialing'));
    expect((await billing.findBySlug('acme'))?.name).toBe('Acme');
    const updated = await billing.updatePlan('o1', 'pro', 'active');
    expect(updated.plan).toBe('pro');
    expect((await billing.findByOrgId('o1'))?.status).toBe('active');
  });
});
