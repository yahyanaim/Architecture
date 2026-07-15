import { IUserRepository } from '../interfaces/IUserRepository';
import { User } from '../entities/User';
import { BusinessException } from '../exceptions/BusinessException';
import { NotFoundException } from '../exceptions/NotFoundException';
import crypto from 'crypto';

/** Generates a cryptographically secure random temporary password. */
function generateTemporaryPassword(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export class UserService {
  constructor(private readonly userRepository: IUserRepository) { }

  async createUser(name: string, email: string): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new BusinessException('User with this email already exists');
    }

    const tempPassword = generateTemporaryPassword();
    const user = await User.create(name, email, tempPassword, 'user');
    await this.userRepository.save(user);
    return user;
  }

  async toggleUserStatus(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.toggleActiveStatus();
    await this.userRepository.save(user);
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }
}
