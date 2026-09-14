import { PostgresExecutor, pgExecutor } from '../pg';
import { IPasskeyRepository } from '../../domain/interfaces/IPasskeyRepository';
import { PasskeyCredential } from '../../domain/entities/PasskeyCredential';

interface Row {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  device_type: string;
  backed_up: number | boolean;
  transports: string | null;
  name: string;
  created_at: string | Date;
  last_used_at: string | Date | null;
}

function toEntity(r: Row): PasskeyCredential {
  return new PasskeyCredential(
    r.id,
    r.user_id,
    r.public_key,
    Number(r.counter),
    r.device_type,
    r.backed_up === 1 || r.backed_up === true,
    r.transports ? (typeof r.transports === 'string' ? JSON.parse(r.transports) : r.transports) : null,
    r.name,
    new Date(r.created_at),
    r.last_used_at ? new Date(r.last_used_at) : null
  );
}

export class PgPasskeyRepository implements IPasskeyRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    this.db = db ?? pgExecutor;
  }

  async findById(id: string): Promise<PasskeyCredential | null> {
    const res = await this.db.query<Row>(
      'SELECT * FROM passkey_credentials WHERE id = $1',
      [id]
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<PasskeyCredential[]> {
    const res = await this.db.query<Row>(
      'SELECT * FROM passkey_credentials WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows.map(toEntity);
  }

  async save(credential: PasskeyCredential): Promise<void> {
    await this.db.query(
      `INSERT INTO passkey_credentials (id, user_id, public_key, counter, device_type, backed_up, transports, name, created_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(id) DO UPDATE SET
         counter = EXCLUDED.counter,
         device_type = EXCLUDED.device_type,
         backed_up = EXCLUDED.backed_up,
         transports = EXCLUDED.transports,
         name = EXCLUDED.name,
         last_used_at = EXCLUDED.last_used_at`,
      [
        credential.id,
        credential.userId,
        credential.publicKey,
        credential.counter,
        credential.deviceType,
        credential.backedUp ? 1 : 0,
        credential.transports ? JSON.stringify(credential.transports) : null,
        credential.name,
        credential.createdAt.toISOString(),
        credential.lastUsedAt ? credential.lastUsedAt.toISOString() : null,
      ]
    );
  }

  async updateCounter(id: string, counter: number, lastUsedAt: Date = new Date()): Promise<void> {
    await this.db.query(
      'UPDATE passkey_credentials SET counter = $1, last_used_at = $2 WHERE id = $3',
      [counter, lastUsedAt.toISOString(), id]
    );
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM passkey_credentials WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }
}
