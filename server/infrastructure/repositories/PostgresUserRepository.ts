import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User } from '../../domain/entities/User';

// swap InMemoryUserRepository for this once you wire up a real db pool
export class PostgresUserRepository implements IUserRepository {
  // constructor(private readonly db: Pool) {}

  async findById(id: string): Promise<User | null> {
    // const result = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    // return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
    throw new Error('Method not implemented.');
  }

  async findByEmail(email: string): Promise<User | null> {
    throw new Error('Method not implemented.');
  }

  async save(user: User): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async findAll(): Promise<User[]> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
