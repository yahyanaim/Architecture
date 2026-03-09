import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User } from '../../domain/entities/User';
import { sql } from '../neon';

export class NeonUserRepository implements IUserRepository {
    async findById(id: string): Promise<User | null> {
        if (!sql) return null;
        const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
        return rows[0] ? this.mapToEntity(rows[0]) : null;
    }

    async findByEmail(email: string): Promise<User | null> {
        if (!sql) return null;
        const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
        return rows[0] ? this.mapToEntity(rows[0]) : null;
    }

    async save(user: User): Promise<void> {
        if (!sql) return;
        await sql`
      INSERT INTO users (id, name, email, created_at, is_active)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${user.createdAt}, ${user.isActive})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        is_active = EXCLUDED.is_active
    `;
    }

    async delete(id: string): Promise<void> {
        if (!sql) return;
        await sql`DELETE FROM users WHERE id = ${id}`;
    }

    async findAll(): Promise<User[]> {
        if (!sql) return [];
        const rows = await sql`SELECT * FROM users ORDER BY created_at DESC`;
        return rows.map(row => this.mapToEntity(row));
    }

    private mapToEntity(row: any): User {
        return new User(
            row.id,
            row.name,
            row.email,
            new Date(row.created_at),
            row.is_active
        );
    }
}
