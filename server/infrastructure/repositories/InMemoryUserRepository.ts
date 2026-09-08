import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User } from '../../domain/entities/User';

// dev/test only — no db needed
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findByEmailAndOrg(email: string, orgId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email && user.orgId === orgId) return user;
    }
    return null;
  }

  async findAllByOrg(orgId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter((u) => u.orgId === orgId);
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async hasUsers(): Promise<boolean> {
    return this.users.size > 0;
  }
}
