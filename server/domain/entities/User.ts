import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export type UserRole = 'admin' | 'user';

export class User {
  constructor(
    public readonly id: string,
    public name: string,
    public email: string,
    public password: string,
    public readonly createdAt: Date,
    public isActive: boolean = true,
    public role: UserRole = 'user',
    public failedLoginAttempts: number = 0,
    public lockedUntil: Date | null = null
  ) {
    if (role !== 'admin' && role !== 'user') {
      throw new Error(`Invalid role: ${role}. Must be 'admin' or 'user'`);
    }
  }

  static async create(name: string, email: string, password: string, role: UserRole = 'user'): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    return new User(crypto.randomUUID(), name, email, hashedPassword, new Date(), true, role);
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  changeName(newName: string) {
    if (newName.length < 3) {
      throw new Error("Name must be at least 3 characters long");
    }
    this.name = newName;
  }

  toggleActiveStatus() {
    this.isActive = !this.isActive;
  }

  isLocked(): boolean {
    if (!this.lockedUntil) return false;
    if (new Date() > this.lockedUntil) {
      this.lockedUntil = null;
      this.failedLoginAttempts = 0;
      return false;
    }
    return true;
  }

  recordFailedAttempt(): void {
    this.failedLoginAttempts++;
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
  }

  resetFailedAttempts(): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
  }
}
