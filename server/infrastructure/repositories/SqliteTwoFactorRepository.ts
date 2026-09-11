import { db } from '../database';
import { ITwoFactorRepository } from '../../domain/interfaces/ITwoFactorRepository';
import { TwoFactorAuth } from '../../domain/entities/TwoFactorAuth';

interface Row {
  user_id: string;
  secret: string;
  is_enabled: number;
  recovery_codes: string;
  created_at: string;
  updated_at: string;
}

function toEntity(r: Row): TwoFactorAuth {
  return new TwoFactorAuth(
    r.user_id,
    r.secret,
    r.is_enabled === 1,
    JSON.parse(r.recovery_codes),
    new Date(r.created_at),
    new Date(r.updated_at)
  );
}

export class SqliteTwoFactorRepository implements ITwoFactorRepository {
  async findByUserId(userId: string): Promise<TwoFactorAuth | null> {
    const row = db.prepare('SELECT * FROM user_two_factor WHERE user_id = ?').get(userId) as
      | Row
      | undefined;
    return row ? toEntity(row) : null;
  }

  async save(twoFactor: TwoFactorAuth): Promise<void> {
    db.prepare(
      `INSERT INTO user_two_factor (user_id, secret, is_enabled, recovery_codes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         secret=excluded.secret,
         is_enabled=excluded.is_enabled,
         recovery_codes=excluded.recovery_codes,
         updated_at=excluded.updated_at`
    ).run(
      twoFactor.userId,
      twoFactor.secret,
      twoFactor.isEnabled ? 1 : 0,
      JSON.stringify(twoFactor.recoveryCodes),
      twoFactor.createdAt.toISOString(),
      twoFactor.updatedAt.toISOString()
    );
  }

  async delete(userId: string): Promise<void> {
    db.prepare('DELETE FROM user_two_factor WHERE user_id = ?').run(userId);
  }
}
