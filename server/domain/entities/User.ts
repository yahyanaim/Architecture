import { IPasswordHasher } from '../interfaces/IPasswordHasher';
import { defaultPasswordHasher } from '../../infrastructure/security/BcryptPasswordHasher';

export type UserRole = 'admin' | 'user';

export class User {
  // DOMAIN INVARIANTS:
  // - `password` is ALWAYS a bcrypt hash here; plaintext never touches the
  //   entity (hashing happens in `create()`/`hashPassword()` before storage).
  // - `failedLoginAttempts`/`lockedUntil` are the brute-force throttle state
  //   machine: N failures -> lock until T. `isLocked()` self-heals (clears an
  //   expired lock) so reads never leave stale lock state behind.
  // - `isActive=false` means administratively disabled: login refuses it and
  //   `requireActiveUser` rejects its tokens. The entity itself stays dumb —
  //   enforcement lives in services/middleware, not in field setters.
  // - TENANCY: `orgId` is the user's workspace. Identity (email) is global so
  //   login needs no tenant hint; authorization/data access is org-scoped.
  // - `emailVerifiedAt=null` means unverified. Verification is enforced
  //   opt-in via `requireVerified` (not on login) so legacy accounts and the
  //   invite flow never hard-lock during rollout.
  constructor(
    public readonly id: string,
    public name: string,
    public email: string,
    public password: string,
    public readonly createdAt: Date,
    public isActive: boolean = true,
    public role: UserRole = 'user',
    public failedLoginAttempts: number = 0,
    public lockedUntil: Date | null = null,
    public orgId: string = 'default',
    public emailVerifiedAt: Date | null = null
  ) {
    if (role !== 'admin' && role !== 'user') {
      throw new Error(`Invalid role: ${role}. Must be 'admin' or 'user'`);
    }
  }

  static async create(
    name: string,
    email: string,
    password: string,
    role: UserRole = 'user',
    hasher: IPasswordHasher = defaultPasswordHasher
  ): Promise<User> {
    const hashedPassword = await hasher.hash(password);
    const id = globalThis.crypto.randomUUID();
    return new User(id, name, email, hashedPassword, new Date(), true, role);
  }

  get isVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  markVerified(): void {
    this.emailVerifiedAt = new Date();
  }

  static async hashPassword(password: string, hasher: IPasswordHasher = defaultPasswordHasher): Promise<string> {
    return hasher.hash(password);
  }

  async comparePassword(password: string, hasher: IPasswordHasher = defaultPasswordHasher): Promise<boolean> {
    return hasher.compare(password, this.password);
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
