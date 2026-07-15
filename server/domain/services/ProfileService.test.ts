import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileService } from './ProfileService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import { User } from '../entities/User';
import { NotFoundException } from '../exceptions/NotFoundException';
import { BusinessException } from '../exceptions/BusinessException';

describe('ProfileService', () => {
  let profileService: ProfileService;
  let userRepository: InMemoryUserRepository;
  let testUser: User;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    profileService = new ProfileService(userRepository);
    testUser = await User.create('Test User', 'test@test.com', 'Password1');
    await userRepository.save(testUser);
  });

  describe('getProfile', () => {
    it('returns the user when found', async () => {
      const profile = await profileService.getProfile(testUser.id);
      expect(profile.id).toBe(testUser.id);
      expect(profile.name).toBe('Test User');
      expect(profile.email).toBe('test@test.com');
    });

    it('throws NotFoundException when user does not exist', async () => {
      await expect(profileService.getProfile('nonexistent-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates the user name', async () => {
      const updated = await profileService.updateProfile(testUser.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('updates the user email', async () => {
      const updated = await profileService.updateProfile(testUser.id, { email: 'new@test.com' });
      expect(updated.email).toBe('new@test.com');
    });

    it('throws BusinessException when email is already in use', async () => {
      const otherUser = await User.create('Other', 'other@test.com', 'Password1');
      await userRepository.save(otherUser);
      await expect(profileService.updateProfile(testUser.id, { email: 'other@test.com' }))
        .rejects.toThrow(BusinessException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      await expect(profileService.updateProfile('nonexistent-id', { name: 'Nope' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('deletes the user', async () => {
      await profileService.deleteAccount(testUser.id);
      const user = await userRepository.findById(testUser.id);
      expect(user).toBeNull();
    });

    it('throws NotFoundException when user does not exist', async () => {
      await expect(profileService.deleteAccount('nonexistent-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    it('changes the password when current password is correct', async () => {
      await profileService.changePassword(testUser.id, 'Password1', 'NewPass123');
      const user = await userRepository.findById(testUser.id);
      const isValid = await user!.comparePassword('NewPass123');
      expect(isValid).toBe(true);
    });

    it('throws BusinessException when current password is incorrect', async () => {
      await expect(profileService.changePassword(testUser.id, 'WrongPass1', 'NewPass123'))
        .rejects.toThrow(BusinessException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      await expect(profileService.changePassword('nonexistent-id', 'Password1', 'NewPass123'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
