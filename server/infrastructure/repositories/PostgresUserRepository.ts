import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User } from '../../domain/entities/User';

/**
 * PostgreSQL implementation of IUserRepository.
 *
 * This is a reference stub — implement each method using your preferred
 * Postgres driver (e.g. `pg`, `@neondatabase/serverless`, `drizzle-orm`).
 *
 * When ready, update the singleton in SharedUserRepository.ts to use this
 * class instead of FileUserRepository. No other files need to change.
 *
 * Example (with `pg` Pool):
 *   constructor(private readonly db: Pool) {}
 *   async findById(id: string) {
 *     const result = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
 *     return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
 *   }
 */
export class PostgresUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    throw new Error('Not implemented. See doc comment above.');
  }

  async findByEmail(email: string): Promise<User | null> {
    throw new Error('Not implemented. See doc comment above.');
  }

  async findByEmailAndOrg(email: string, orgId: string): Promise<User | null> {
    throw new Error('Not implemented. See doc comment above.');
  }

  async findAllByOrg(orgId: string): Promise<User[]> {
    throw new Error('Not implemented. See doc comment above.');
  }

  async save(user: User): Promise<void> {
    throw new Error('Not implemented. See doc comment above.');
  }

  async findAll(): Promise<User[]> {
    throw new Error('Not implemented. See doc comment above.');
  }

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented. See doc comment above.');
  }

  async hasUsers(): Promise<boolean> {
    throw new Error('Not implemented. See doc comment above.');
  }
}