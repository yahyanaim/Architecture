import { db } from '../database';
import { IOAuthAccountRepository } from '../../domain/interfaces/IOAuthAccountRepository';
import { OAuthAccount } from '../../domain/entities/OAuthAccount';

interface Row {
  id: string;
  user_id: string;
  provider: string;
  provider_sub: string;
  org_id: string;
  created_at: string;
  updated_at: string;
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

export class SqliteOAuthAccountRepository implements IOAuthAccountRepository {
  async findByProviderAndSub(provider: string, providerSub: string): Promise<OAuthAccount | null> {
    const row = db
      .prepare('SELECT * FROM oauth_accounts WHERE provider = ? AND provider_sub = ?')
      .get(provider.toLowerCase(), providerSub) as Row | undefined;
    return row ? toEntity(row) : null;
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    const rows = db
      .prepare('SELECT * FROM oauth_accounts WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Row[];
    return rows.map(toEntity);
  }

  async save(account: OAuthAccount): Promise<void> {
    db.prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_sub, org_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_sub) DO UPDATE SET
         user_id=excluded.user_id,
         org_id=excluded.org_id,
         updated_at=excluded.updated_at`
    ).run(
      account.id,
      account.userId,
      account.provider.toLowerCase(),
      account.providerSub,
      account.orgId,
      account.createdAt.toISOString(),
      account.updatedAt.toISOString()
    );
  }

  async delete(id: string): Promise<void> {
    db.prepare('DELETE FROM oauth_accounts WHERE id = ?').run(id);
  }
}
