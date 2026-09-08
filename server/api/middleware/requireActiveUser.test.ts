import { describe, it, expect, vi } from 'vitest';
import { createRequireActiveUser } from './requireActiveUser';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import { User } from '../../domain/entities/User';

// Guards the session-liveness invariant: a valid signature is not enough —
// the account must still exist and be active on every protected request.
describe('requireActiveUser', () => {
  const res = () => {
    const r: any = {};
    r.status = vi.fn().mockReturnValue(r);
    r.json = vi.fn().mockReturnValue(r);
    return r;
  };

  it('passes a live active user through', async () => {
    const repo = new InMemoryUserRepository();
    const user = await User.create('Ann', 'ann@example.com', 'Password1', 'user');
    await repo.save(user);
    const mw = createRequireActiveUser(repo);
    const req: any = { user: { userId: user.id, email: user.email, role: 'user' } };
    const next = vi.fn();
    await mw(req, res(), next);
    expect(next).toHaveBeenCalled();
  });

  it('401s a deleted account (token outlived the user)', async () => {
    const repo = new InMemoryUserRepository();
    const mw = createRequireActiveUser(repo);
    const req: any = { user: { userId: 'gone', email: 'g@x.com', role: 'user' } };
    const r = res();
    const next = vi.fn();
    await mw(req, r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s a deactivated account', async () => {
    const repo = new InMemoryUserRepository();
    const user = await User.create('Bob', 'bob@example.com', 'Password1', 'user');
    user.toggleActiveStatus(); // active -> inactive
    await repo.save(user);
    const mw = createRequireActiveUser(repo);
    const req: any = { user: { userId: user.id, email: user.email, role: 'user' } };
    const r = res();
    const next = vi.fn();
    await mw(req, r, next);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s with no identity (miswired chain)', async () => {
    const repo = new InMemoryUserRepository();
    const mw = createRequireActiveUser(repo);
    const r = res();
    const next = vi.fn();
    await mw({} as any, r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
