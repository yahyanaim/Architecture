import { IUserRepository } from '../interfaces/IUserRepository';
import { ITokenStore } from '../interfaces/ITenant';
import { User } from '../entities/User';
import { NotFoundException } from '../exceptions/NotFoundException';
import { BusinessException } from '../exceptions/BusinessException';

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export class ProfileService {
  // `tokenStore` is optional for backward compatibility (tests construct with
  // repo only). In the app it is ALWAYS wired: a password change must kill
  // all other sessions (see changePassword).
  constructor(private readonly userRepository: IUserRepository, private readonly tokenStore?: ITokenStore) { }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, updates: UpdateProfileInput): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updates.email && updates.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(updates.email);
      if (existingUser && existingUser.id !== userId) {
        throw new BusinessException('Email already in use');
      }
      user.email = updates.email;
      user.emailVerifiedAt = null; // Email changed -> requires re-verification
    }

    if (updates.name) {
      user.name = updates.name;
    }

    await this.userRepository.save(user);
    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin') {
      const orgUsers = await this.userRepository.findAllByOrg(user.orgId);
      const otherMembers = orgUsers.filter((u) => u.id !== userId);
      const otherAdmins = otherMembers.filter((u) => u.role === 'admin' && u.isActive);
      if (otherMembers.length > 0 && otherAdmins.length === 0) {
        throw new BusinessException('Cannot delete account: you are the sole admin of this workspace. Promote another member first.');
      }
    }

    await this.userRepository.delete(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new BusinessException('Current password is incorrect');
    }

    user.password = await User.hashPassword(newPassword);
    await this.userRepository.save(user);
    // Credential change = session kill: every OTHER device/session dies with
    // the old password (the caller's session is refreshed by the controller
    // issuing a new pair — see ProfileController.changePassword).
    if (this.tokenStore) {
      await this.tokenStore.revokeAllForUser(userId);
    }
  }
}