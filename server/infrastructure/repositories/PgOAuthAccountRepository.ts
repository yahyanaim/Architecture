import { PostgresExecutor, pgExecutor } from '../pg';
import { IOAuthAccountRepository } from '../../domain/interfaces/IOAuthAccountRepository';
import { OAuthAccount } from '../../domain/entities/OAuthAccount';

interface Row {
  id: string;
  user_id: string;
  provider: string;
  provider_sub: string;
  org_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

function toEntity(r: Row): OAuthAccount {
  return new OAuthAccount(
    r.id,
    r.user_id,
    r.provider,
    r.provider_sub,
    r.org_id,
    new Date(r.created_at),
    new Date(r.updated_at)
  );
}

export class PgOAuthAccountRepository implements IOAuthAccountRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    this.db = db ?? pgExecutor;
  }

  async findByProviderAndSub(provider: string, providerSub: string): Promise<OAuthAccount | null> {
    const res = await this.db.query<Row>(
      'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_sub = $2',
      [provider.toLowerCase(), providerSub]
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    const res = await this.db.query<Row>(
      'SELECT * FROM oauth_accounts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows.map(toEntity);
  }

  async save(account: OAuthAccount): Promise<void> {
    await this.db.query(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_sub, org_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (provider, provider_sub) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         org_id = EXCLUDED.org_id,
         updated_at = EXCLUDED.updated_at`,
      [
        account.id,
        account.userId,
        account.provider.toLowerCase(),
        account.providerSub,
        account.orgId,
        account.createdAt.toISOString(),
        account.updatedAt.toISOString()
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM oauth_accounts WHERE id = $1', [id]);
  }
}

export { PgOAuthAccountRepository as PostgresOAuthAccountRepository };
