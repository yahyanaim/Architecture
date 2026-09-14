import { PostgresExecutor, pgExecutor } from '../pg';
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
  expires_at: string | Date | null;
  last_used_at: string | Date | null;
  created_at: string | Date;
}

function toEntity(r: Row): ApiKey {
  return new ApiKey(
    r.id,
    r.org_id,
    r.user_id,
    r.name,
    r.key_prefix,
    r.key_hash,
    typeof r.scopes === 'string' ? JSON.parse(r.scopes) : r.scopes,
    r.expires_at ? new Date(r.expires_at) : null,
    r.last_used_at ? new Date(r.last_used_at) : null,
    new Date(r.created_at)
  );
}

export class PgApiKeyRepository implements IApiKeyRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    this.db = db ?? pgExecutor;
  }

  async findById(id: string, orgId: string): Promise<ApiKey | null> {
    const res = await this.db.query<Row>(
      'SELECT * FROM api_keys WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const res = await this.db.query<Row>(
      'SELECT * FROM api_keys WHERE key_hash = $1',
      [keyHash]
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findAllByOrg(orgId: string): Promise<ApiKey[]> {
    const res = await this.db.query<Row>(
      'SELECT * FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    );
    return res.rows.map(toEntity);
  }

  async save(apiKey: ApiKey): Promise<void> {
    await this.db.query(
      `INSERT INTO api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, expires_at, last_used_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(id) DO UPDATE SET
         name = EXCLUDED.name,
         scopes = EXCLUDED.scopes,
         expires_at = EXCLUDED.expires_at,
         last_used_at = EXCLUDED.last_used_at`,
      [
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
      ]
    );
  }

  async updateLastUsed(id: string, orgId: string): Promise<void> {
    await this.db.query(
      'UPDATE api_keys SET last_used_at = $1 WHERE id = $2 AND org_id = $3',
      [new Date().toISOString(), id, orgId]
    );
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.query('DELETE FROM api_keys WHERE id = $1 AND org_id = $2', [id, orgId]);
  }
}

export { PgApiKeyRepository as PostgresApiKeyRepository };
