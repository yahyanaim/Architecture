import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User } from '../../domain/entities/User';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'users.json');

function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
  }
}

interface UserData {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
  isActive: boolean;
  role: 'admin' | 'user';
  failedLoginAttempts: number;
  lockedUntil: string | null;
  orgId?: string;
  emailVerifiedAt?: string | null;
}

function readUsers(): User[] {
  ensureDbExists();
  const data = fs.readFileSync(DB_PATH, 'utf-8');
  const users: UserData[] = JSON.parse(data);
  return users.map(u => new User(u.id, u.name, u.email, u.password, new Date(u.createdAt), u.isActive, u.role, u.failedLoginAttempts ?? 0, u.lockedUntil ? new Date(u.lockedUntil) : null, u.orgId ?? 'default', u.emailVerifiedAt ? new Date(u.emailVerifiedAt) : null));
}

function writeUsers(users: User[]) {
  ensureDbExists();
  const data: UserData[] = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    password: u.password,
    createdAt: u.createdAt.toISOString(),
    isActive: u.isActive,
    role: u.role,
    failedLoginAttempts: u.failedLoginAttempts,
    lockedUntil: u.lockedUntil?.toISOString() ?? null,
    orgId: u.orgId,
    emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
  }));
  // DATA LIFECYCLE: write temp + atomic rename so a crash mid-write never
  // leaves a half-written `users.json` (readers always see the old or the new
  // file, never a torn one). This does NOT fix the read-modify-write race
  // between concurrent requests (two overlapping save() calls can still
  // overwrite each other) — that needs a real DB with transactions
  // (`better-sqlite3` is already installed for that migration). Treat this
  // adapter as single-writer/demo-grade.
  const tmpPath = DB_PATH + `.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, DB_PATH);
}

// HEXAGONAL ADAPTER: implements the `IUserRepository` port with a JSON file.
// The domain never knows storage exists — services depend only on the port
// interface, so swapping to SQLite/Postgres means adding an adapter + one
// line in `SharedUserRepository`, with zero domain changes.
/**
 * @deprecated Legacy adapter — superseded by `SqliteUserRepository` (schema,
 * migrations, atomic transactions). Kept for reference and offline tests;
 * NOT wired into the app anymore (see `SharedUserRepository`). Do not extend.
 */
export class FileUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const users = readUsers();
    return users.find(u => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = readUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findByEmailAndOrg(email: string, orgId: string): Promise<User | null> {
    const users = readUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.orgId === orgId) || null;
  }

  async findAllByOrg(orgId: string): Promise<User[]> {
    return readUsers().filter(u => u.orgId === orgId);
  }

  async hasUsers(): Promise<boolean> {
    const users = readUsers();
    return users.length > 0;
  }

  async save(user: User): Promise<void> {
    const users = readUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    writeUsers(users);
  }

  async delete(id: string): Promise<void> {
    const users = readUsers();
    const filtered = users.filter(u => u.id !== id);
    writeUsers(filtered);
  }
}