import { db } from '../database';
import { IPasskeyRepository } from '../../domain/interfaces/IPasskeyRepository';
import { PasskeyCredential } from '../../domain/entities/PasskeyCredential';

interface Row {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  device_type: string;
  backed_up: number;
  transports: string | null;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

function toEntity(r: Row): PasskeyCredential {
  return new PasskeyCredential(
    r.id,
    r.user_id,
    r.public_key,
    r.counter,
    r.device_type,
    r.backed_up === 1,
    r.transports ? JSON.parse(r.transports) : null,
    r.name,
    new Date(r.created_at),
    r.last_used_at ? new Date(r.last_used_at) : null
  );
}

export class SqlitePasskeyRepository implements IPasskeyRepository {
  async findById(id: string): Promise<PasskeyCredential | null> {
    const row = db.prepare('SELECT * FROM passkey_credentials WHERE id = ?').get(id) as Row | undefined;
    return row ? toEntity(row) : null;
  }

  async findByUserId(userId: string): Promise<PasskeyCredential[]> {
    const rows = db
      .prepare('SELECT * FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Row[];
    return rows.map(toEntity);
  }

  async save(credential: PasskeyCredential): Promise<void> {
    db.prepare(
      `INSERT INTO passkey_credentials (id, user_id, public_key, counter, device_type, backed_up, transports, name, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         counter=excluded.counter,
         device_type=excluded.device_type,
         backed_up=excluded.backed_up,
         transports=excluded.transports,
         name=excluded.name,
         last_used_at=excluded.last_used_at`
    ).run(
      credential.id,
      credential.userId,
      credential.publicKey,
      credential.counter,
      credential.deviceType,
      credential.backedUp ? 1 : 0,
      credential.transports ? JSON.stringify(credential.transports) : null,
      credential.name,
      credential.createdAt.toISOString(),
      credential.lastUsedAt ? credential.lastUsedAt.toISOString() : null
    );
  }

  async updateCounter(id: string, counter: number, lastUsedAt: Date = new Date()): Promise<void> {
    db.prepare('UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE id = ?').run(
      counter,
      lastUsedAt.toISOString(),
      id
    );
  }

  async delete(id: string, userId: string): Promise<void> {
    db.prepare('DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?').run(id, userId);
  }
}
