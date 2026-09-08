import bcrypt from 'bcryptjs';
import { IPasswordHasher } from '../../domain/interfaces/IPasswordHasher';

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly saltRounds = 10) {}

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export const defaultPasswordHasher = new BcryptPasswordHasher();
