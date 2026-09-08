import crypto from 'crypto';
import { db } from '../database';
import {
  ITokenStore, RefreshSession, AuthToken, AuthTokenType,
} from '../../domain/interfaces/ITenant';

function now(): string {
  return new Date().toISOString();
}
function uid(): string {
  return crypto.randomUUID();
}

/**
 * Token persistence for refresh rotation + single-use flows.
 * SECURITY: only hashes are stored; `consumeAuthToken` marks used
 * atomically (single UPDATE with guards) so a token can't be double-spent
 * even under concurrent requests.
 */
export class SqliteTokenStore implements ITokenStore {
  async createRefresh(input: { userId: string; tokenHash: string; expiresAt: Date; ip?: string }): Promise<RefreshSession> {
    const id = uid();
    db.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, replaced_by, created_at, ip) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)'
    ).run(id, input.userId, input.tokenHash, input.expiresAt.toISOString(), now(), input.ip ?? null);
    return (await this.findRefreshByHash(input.tokenHash))!;
  }

  async findRefreshByHash(tokenHash: string): Promise<RefreshSession | null> {
    const r = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) as any;
    if (!r) return null;
    return {
      id: r.id, userId: r.user_id, tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at),
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      replacedBy: r.replaced_by ?? null,
      createdAt: new Date(r.created_at),
    };
  }

  async revokeRefresh(id: string, replacedBy?: string | null): Promise<void> {
    db.prepare('UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE id = ? AND revoked_at IS NULL')
      .run(now(), replacedBy ?? null, id);
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const res = db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
      .run(now(), userId);
    return Number(res.changes);
  }

  async deleteExpiredRefresh(before: Date = new Date()): Promise<number> {
    const res = db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(before.toISOString());
    return Number(res.changes);
  }

  async createAuthToken(input: {
    userId: string | null; type: AuthTokenType; tokenHash: string; expiresAt: Date; meta?: Record<string, unknown>;
  }): Promise<AuthToken> {
    const id = uid();
    db.prepare(
      'INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, used_at, created_at, meta) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)'
    ).run(id, input.userId, input.type, input.tokenHash, input.expiresAt.toISOString(), now(), JSON.stringify(input.meta ?? {}));
    return {
      id, userId: input.userId, type: input.type, tokenHash: input.tokenHash,
      expiresAt: input.expiresAt, usedAt: null, createdAt: new Date(), meta: input.meta ?? {},
    };
  }

  async consumeAuthToken(tokenHash: string, type: AuthTokenType): Promise<AuthToken | null> {
    const r = db.prepare('SELECT * FROM auth_tokens WHERE token_hash = ? AND type = ?').get(tokenHash, type) as any;
    if (!r) return null;
    if (r.used_at) return null;
    if (new Date(r.expires_at).getTime() < Date.now()) return null;
    // Atomic single-use: only the first concurrent consumer wins.
    const res = db.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').run(now(), r.id);
    if (res.changes === 0) return null;
    return {
      id: r.id, userId: r.user_id, type: r.type, tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at), usedAt: new Date(),
      createdAt: new Date(r.created_at), meta: r.meta ? JSON.parse(r.meta) : {},
    };
  }
}
