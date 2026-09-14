import crypto from 'crypto';
import { PostgresExecutor, pgExecutor } from '../pg';
import {
  ITokenStore, RefreshSession, AuthToken, AuthTokenType,
} from '../../domain/interfaces/ITenant';

function now(): string {
  return new Date().toISOString();
}

function uid(): string {
  return crypto.randomUUID();
}

interface RefreshRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
  replaced_by: string | null;
  created_at: string | Date;
  ip: string | null;
}

interface AuthTokenRow {
  id: string;
  user_id: string | null;
  type: string;
  token_hash: string;
  expires_at: string | Date;
  used_at: string | Date | null;
  created_at: string | Date;
  meta: string | null;
}

export class PgTokenStore implements ITokenStore {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    this.db = db ?? pgExecutor;
  }

  async createRefresh(input: { userId: string; tokenHash: string; expiresAt: Date; ip?: string }): Promise<RefreshSession> {
    const id = uid();
    await this.db.query(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, replaced_by, created_at, ip) VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6)',
      [id, input.userId, input.tokenHash, input.expiresAt.toISOString(), now(), input.ip ?? null]
    );
    return (await this.findRefreshByHash(input.tokenHash))!;
  }

  async findRefreshByHash(tokenHash: string): Promise<RefreshSession | null> {
    const res = await this.db.query<RefreshRow>('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at),
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      replacedBy: r.replaced_by ?? null,
      createdAt: new Date(r.created_at),
    };
  }

  async revokeRefresh(id: string, replacedBy?: string | null): Promise<void> {
    await this.db.query(
      'UPDATE refresh_tokens SET revoked_at = $1, replaced_by = $2 WHERE id = $3 AND revoked_at IS NULL',
      [now(), replacedBy ?? null, id]
    );
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const res = await this.db.query(
      'UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL',
      [now(), userId]
    );
    return Number(res.rowCount ?? 0);
  }

  async deleteExpiredRefresh(before: Date = new Date()): Promise<number> {
    const res = await this.db.query(
      'DELETE FROM refresh_tokens WHERE expires_at < $1',
      [before.toISOString()]
    );
    return Number(res.rowCount ?? 0);
  }

  async createAuthToken(input: {
    userId: string | null; type: AuthTokenType; tokenHash: string; expiresAt: Date; meta?: Record<string, unknown>;
  }): Promise<AuthToken> {
    const id = uid();
    await this.db.query(
      'INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, used_at, created_at, meta) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)',
      [id, input.userId, input.type, input.tokenHash, input.expiresAt.toISOString(), now(), JSON.stringify(input.meta ?? {})]
    );
    return {
      id,
      userId: input.userId,
      type: input.type,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: new Date(),
      meta: input.meta ?? {},
    };
  }

  async consumeAuthToken(tokenHash: string, type: AuthTokenType): Promise<AuthToken | null> {
    const res = await this.db.query<AuthTokenRow>(
      'SELECT * FROM auth_tokens WHERE token_hash = $1 AND type = $2',
      [tokenHash, type]
    );
    const r = res.rows[0];
    if (!r) return null;
    if (r.used_at) return null;
    if (new Date(r.expires_at).getTime() < Date.now()) return null;

    // Atomic single-use: only the first concurrent consumer wins.
    const updateRes = await this.db.query(
      'UPDATE auth_tokens SET used_at = $1 WHERE id = $2 AND used_at IS NULL',
      [now(), r.id]
    );
    if ((updateRes.rowCount ?? 0) === 0) return null;

    return {
      id: r.id,
      userId: r.user_id,
      type: r.type as AuthTokenType,
      tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at),
      usedAt: new Date(),
      createdAt: new Date(r.created_at),
      meta: r.meta ? JSON.parse(r.meta) : {},
    };
  }
}

export { PgTokenStore as PostgresTokenStore };
