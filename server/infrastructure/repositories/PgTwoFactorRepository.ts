import { PostgresExecutor, pgExecutor } from '../pg';
import { ITwoFactorRepository } from '../../domain/interfaces/ITwoFactorRepository';
import { TwoFactorAuth } from '../../domain/entities/TwoFactorAuth';

interface Row {
  user_id: string;
  secret: string;
  is_enabled: number | boolean;
  recovery_codes: string;
  created_at: string | Date;
  updated_at: string | Date;
}

function toEntity(r: Row): TwoFactorAuth {
  return new TwoFactorAuth(
    r.user_id,
    r.secret,
    r.is_enabled === 1 || r.is_enabled === true,
    typeof r.recovery_codes === 'string' ? JSON.parse(r.recovery_codes) : r.recovery_codes,
    new Date(r.created_at),
    new Date(r.updated_at)
  );
}

export class PgTwoFactorRepository implements ITwoFactorRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    this.db = db ?? pgExecutor;
  }

  async findByUserId(userId: string): Promise<TwoFactorAuth | null> {
    const res = await this.db.query<Row>(
      'SELECT * FROM user_two_factor WHERE user_id = $1',
      [userId]
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async save(twoFactor: TwoFactorAuth): Promise<void> {
    await this.db.query(
      `INSERT INTO user_two_factor (user_id, secret, is_enabled, recovery_codes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(user_id) DO UPDATE SET
         secret = EXCLUDED.secret,
         is_enabled = EXCLUDED.is_enabled,
         recovery_codes = EXCLUDED.recovery_codes,
         updated_at = EXCLUDED.updated_at`,
      [
        twoFactor.userId,
        twoFactor.secret,
        twoFactor.isEnabled ? 1 : 0,
        JSON.stringify(twoFactor.recoveryCodes),
        twoFactor.createdAt.toISOString(),
        twoFactor.updatedAt.toISOString(),
      ]
    );
  }

  async delete(userId: string): Promise<void> {
    await this.db.query('DELETE FROM user_two_factor WHERE user_id = $1', [userId]);
  }
}

export { PgTwoFactorRepository as PostgresTwoFactorRepository };
