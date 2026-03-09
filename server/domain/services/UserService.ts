import { IUserRepository } from '../interfaces/IUserRepository';
import { User } from '../entities/User';
import { BusinessException } from '../exceptions/BusinessException';
import { NotFoundException } from '../exceptions/NotFoundException';
import crypto from 'crypto';

export class UserService {
  constructor(private readonly userRepository: IUserRepository) { }

  async createUser(name: string, email: string): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new BusinessException('User with this email already exists');
    }

    const user = new User(crypto.randomUUID(), name, email, new Date(), true);
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
