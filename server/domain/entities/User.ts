import { IPasswordHasher } from '../interfaces/IPasswordHasher';

export type UserRole = 'admin' | 'user';

export class User {
  // DOMAIN INVARIANTS:
  // - `password` is ALWAYS a bcrypt hash here; plaintext never touches the
  //   entity (hashing happens in `create()`/`hashPassword()` before storage).
  // - `failedLoginAttempts`/`lockedUntil` are the brute-force throttle state
  //   machine: N failures -> lock until T. `isLocked()` is a pure query;
  //   expired lock clearing is handled via `clearExpiredLock()`.
  // - `isActive=false` means administratively disabled: login refuses it and
  //   `requireActiveUser` rejects its tokens. The entity itself stays dumb —
  //   enforcement lives in services/middleware, not in field setters.
  // - TENANCY: `orgId` is the user's workspace. Identity (email) is global so
  //   login needs no tenant hint; authorization/data access is org-scoped.
  // - `emailVerifiedAt=null` means unverified. Verification is enforced
  //   opt-in via `requireVerified` (not on login) so legacy accounts and the
  //   invite flow never hard-lock during rollout.

  private static defaultHasher: IPasswordHasher | null = null;

  /** Sets the default password hasher port implementation from the composition root. */
  static setDefaultHasher(hasher: IPasswordHasher): void {
    User.defaultHasher = hasher;
  }

  private static getHasher(hasher?: IPasswordHasher): IPasswordHasher {
    const active = hasher ?? User.defaultHasher;
    if (!active) {
      throw new Error(
        'IPasswordHasher port not configured. Either pass a hasher argument or call User.setDefaultHasher() in composition root.'
      );
    }
    return active;
  }

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
    hasher?: IPasswordHasher
  ): Promise<User> {
    const activeHasher = User.getHasher(hasher);
    const hashedPassword = await activeHasher.hash(password);
    const id = globalThis.crypto.randomUUID();
    return new User(id, name, email, hashedPassword, new Date(), true, role);
  }

  get isVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  markVerified(): void {
    this.emailVerifiedAt = new Date();
  }

  static async hashPassword(password: string, hasher?: IPasswordHasher): Promise<string> {
    return User.getHasher(hasher).hash(password);
  }

  async comparePassword(password: string, hasher?: IPasswordHasher): Promise<boolean> {
    return User.getHasher(hasher).compare(password, this.password);
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

  /** Pure query: checks if the user account is locked at the given timestamp. */
  isLocked(at: Date = new Date()): boolean {
    if (!this.lockedUntil) return false;
    return at <= this.lockedUntil;
  }

  /** Command: clears expired lock state. Returns true if an expired lock was cleared. */
  clearExpiredLock(at: Date = new Date()): boolean {
    if (this.lockedUntil && at > this.lockedUntil) {
      this.lockedUntil = null;
      this.failedLoginAttempts = 0;
      return true;
    }
    return false;
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
