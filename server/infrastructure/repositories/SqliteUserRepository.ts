import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User, UserRole } from '../../domain/entities/User';
import { db } from '../database';

interface Row {
  id: string; name: string; email: string; password: string; org_id: string;
  created_at: string; is_active: number; role: string;
  failed_attempts: number; locked_until: string | null; email_verified_at: string | null;
}

function toEntity(r: Row): User {
  return new User(
    r.id, r.name, r.email, r.password, new Date(r.created_at),
    r.is_active === 1, r.role as UserRole, r.failed_attempts ?? 0,
    r.locked_until ? new Date(r.locked_until) : null,
    r.org_id, r.email_verified_at ? new Date(r.email_verified_at) : null
  );
}

/**
 * Primary user adapter (dev + prod). better-sqlite3 is synchronous; methods
 * stay async to honor the port contract so a future Postgres adapter drops
 * in without touching services. Timestamps are ISO-8601 TEXT (portable).
 */
export class SqliteUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
    return row ? toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as Row | undefined;
    return row ? toEntity(row) : null;
  }

  async findByEmailAndOrg(email: string, orgId: string): Promise<User | null> {
    const row = db.prepare('SELECT * FROM users WHERE email = ? AND org_id = ?').get(email.toLowerCase(), orgId) as Row | undefined;
    return row ? toEntity(row) : null;
  }

  async findAllByOrg(orgId: string): Promise<User[]> {
    const rows = db.prepare('SELECT * FROM users WHERE org_id = ? ORDER BY created_at ASC').all(orgId) as Row[];
    return rows.map(toEntity);
  }

  async save(user: User): Promise<void> {
    db.prepare(
      `INSERT INTO users (id, name, email, password, org_id, created_at, is_active, role, failed_attempts, locked_until, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, email=excluded.email, password=excluded.password, org_id=excluded.org_id,
         is_active=excluded.is_active, role=excluded.role, failed_attempts=excluded.failed_attempts,
         locked_until=excluded.locked_until, email_verified_at=excluded.email_verified_at`
    ).run(
      user.id, user.name, user.email.toLowerCase(), user.password, user.orgId,
      user.createdAt.toISOString(), user.isActive ? 1 : 0, user.role,
      user.failedLoginAttempts, user.lockedUntil?.toISOString() ?? null,
      user.emailVerifiedAt?.toISOString() ?? null
    );
  }

  async delete(id: string): Promise<void> {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  async hasUsers(): Promise<boolean> {
    const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return row.n > 0;
  }
}
