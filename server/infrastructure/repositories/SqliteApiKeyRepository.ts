import { db } from '../database';
import { IApiKeyRepository } from '../../domain/interfaces/IApiKeyRepository';
import { ApiKey } from '../../domain/entities/ApiKey';

interface Row {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

function toEntity(r: Row): ApiKey {
  return new ApiKey(
    r.id,
    r.org_id,
    r.user_id,
    r.name,
    r.key_prefix,
    r.key_hash,
    JSON.parse(r.scopes),
    r.expires_at ? new Date(r.expires_at) : null,
    r.last_used_at ? new Date(r.last_used_at) : null,
    new Date(r.created_at)
  );
}

export class SqliteApiKeyRepository implements IApiKeyRepository {
  async findById(id: string, orgId: string): Promise<ApiKey | null> {
    const row = db
      .prepare('SELECT * FROM api_keys WHERE id = ? AND org_id = ?')
      .get(id, orgId) as Row | undefined;
    return row ? toEntity(row) : null;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const row = db
      .prepare('SELECT * FROM api_keys WHERE key_hash = ?')
      .get(keyHash) as Row | undefined;
    return row ? toEntity(row) : null;
  }

  async findAllByOrg(orgId: string): Promise<ApiKey[]> {
    const rows = db
      .prepare('SELECT * FROM api_keys WHERE org_id = ? ORDER BY created_at DESC')
      .all(orgId) as Row[];
    return rows.map(toEntity);
  }

  async save(apiKey: ApiKey): Promise<void> {
    db.prepare(
      `INSERT INTO api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, expires_at, last_used_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         scopes=excluded.scopes,
         expires_at=excluded.expires_at,
         last_used_at=excluded.last_used_at`
    ).run(
      apiKey.id,
      apiKey.orgId,
      apiKey.userId,
      apiKey.name,
      apiKey.keyPrefix,
      apiKey.keyHash,
      JSON.stringify(apiKey.scopes),
      apiKey.expiresAt?.toISOString() ?? null,
      apiKey.lastUsedAt?.toISOString() ?? null,
      apiKey.createdAt.toISOString()
    );
  }

  async updateLastUsed(id: string, orgId: string): Promise<void> {
    db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ? AND org_id = ?').run(
      new Date().toISOString(),
      id,
      orgId
    );
  }

  async delete(id: string, orgId: string): Promise<void> {
    db.prepare('DELETE FROM api_keys WHERE id = ? AND org_id = ?').run(id, orgId);
  }
}
