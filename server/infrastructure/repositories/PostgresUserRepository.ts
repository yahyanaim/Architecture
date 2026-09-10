import { Pool } from '@neondatabase/serverless';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User, UserRole } from '../../domain/entities/User';

export interface PostgresExecutor {
  query<R = any>(text: string, params?: any[]): Promise<{ rows: R[]; rowCount?: number | null }>;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  org_id: string;
  created_at: string | Date;
  is_active: boolean | number;
  role: string;
  failed_attempts: number;
  locked_until: string | Date | null;
  email_verified_at: string | Date | null;
}

function toEntity(r: UserRow): User {
  return new User(
    r.id,
    r.name,
    r.email,
    r.password,
    new Date(r.created_at),
    r.is_active === true || r.is_active === 1,
    r.role as UserRole,
    r.failed_attempts ?? 0,
    r.locked_until ? new Date(r.locked_until) : null,
    r.org_id,
    r.email_verified_at ? new Date(r.email_verified_at) : null
  );
}

/**
 * PostgreSQL / Neon implementation of IUserRepository.
 * Accepts a custom executor or defaults to Neon serverless Pool.
 */
export class PostgresUserRepository implements IUserRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    if (db) {
      this.db = db;
    } else {
      const connectionString = process.env.DATABASE_URL;
      this.db = new Pool({ connectionString });
    }
  }

  async findById(id: string): Promise<User | null> {
    const res = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await this.db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findByEmailAndOrg(email: string, orgId: string): Promise<User | null> {
    const res = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE email = $1 AND org_id = $2',
      [email.toLowerCase(), orgId]
    );
    return res.rows[0] ? toEntity(res.rows[0]) : null;
  }

  async findAllByOrg(orgId: string): Promise<User[]> {
    const res = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE org_id = $1 ORDER BY created_at ASC',
      [orgId]
    );
    return res.rows.map(toEntity);
  }

  async save(user: User): Promise<void> {
    const query = `
      INSERT INTO users (id, name, email, password, org_id, created_at, is_active, role, failed_attempts, locked_until, email_verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        org_id = EXCLUDED.org_id,
        is_active = EXCLUDED.is_active,
        role = EXCLUDED.role,
        failed_attempts = EXCLUDED.failed_attempts,
        locked_until = EXCLUDED.locked_until,
        email_verified_at = EXCLUDED.email_verified_at
    `;
    await this.db.query(query, [
      user.id,
      user.name,
      user.email.toLowerCase(),
      user.password,
      user.orgId,
      user.createdAt.toISOString(),
      user.isActive,
      user.role,
      user.failedLoginAttempts,
      user.lockedUntil?.toISOString() ?? null,
      user.emailVerifiedAt?.toISOString() ?? null
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
  }

  async hasUsers(): Promise<boolean> {
    const res = await this.db.query<{ count: string | number }>('SELECT COUNT(*) AS count FROM users');
    return Number(res.rows[0]?.count ?? 0) > 0;
  }
}