import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './UserService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import { User } from '../entities/User';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    userService = new UserService(userRepository);
  });

  describe('createUser', () => {
    it('creates a user with a secure temporary password', async () => {
      const user = await userService.createUser('John Doe', 'john@example.com');

      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@example.com');
      expect(user.password).toBeDefined();
      expect(user.password.length).toBeGreaterThan(20);
    });

    it('throws BusinessException if email already exists', async () => {
      await userService.createUser('John Doe', 'john@example.com');

      await expect(
        userService.createUser('Jane Doe', 'john@example.com')
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('toggleUserStatus', () => {
    it('toggles user active status from true to false', async () => {
      const user = await userService.createUser('John Doe', 'john@example.com');
      expect(user.isActive).toBe(true);

      const toggled = await userService.toggleUserStatus(user.id);
      expect(toggled.isActive).toBe(false);
    });

    it('toggles user active status from false to true', async () => {
      const user = await userService.createUser('John Doe', 'john@example.com');
      await userService.toggleUserStatus(user.id);

      const toggled = await userService.toggleUserStatus(user.id);
      expect(toggled.isActive).toBe(true);
    });

    it('throws NotFoundException if user does not exist', async () => {
      await expect(
        userService.toggleUserStatus('non-existent-id')
      ).rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('deletes an existing user', async () => {
      const user = await userService.createUser('John Doe', 'john@example.com');
      await userService.deleteUser(user.id);

      const found = await userRepository.findById(user.id);
      expect(found).toBeNull();
    });

    it('throws NotFoundException if user does not exist', async () => {
      await expect(
        userService.deleteUser('non-existent-id')
      ).rejects.toThrow('User not found');
    });
  });

  describe('getAllUsers', () => {
    it('returns all users', async () => {
      await userService.createUser('John Doe', 'john@example.com');
      await userService.createUser('Jane Doe', 'jane@example.com');

      const users = await userService.getAllUsers();
      expect(users).toHaveLength(2);
    });

    it('returns empty array when no users exist', async () => {
      const users = await userService.getAllUsers();
      expect(users).toHaveLength(0);
    });
  });
});
