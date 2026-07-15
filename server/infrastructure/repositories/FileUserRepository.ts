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
}

function readUsers(): User[] {
  ensureDbExists();
  const data = fs.readFileSync(DB_PATH, 'utf-8');
  const users: UserData[] = JSON.parse(data);
  return users.map(u => new User(u.id, u.name, u.email, u.password, new Date(u.createdAt), u.isActive, u.role, u.failedLoginAttempts ?? 0, u.lockedUntil ? new Date(u.lockedUntil) : null));
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
  }));
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export class FileUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const users = readUsers();
    return users.find(u => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = readUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
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

  async findAll(): Promise<User[]> {
    return readUsers();
  }
}