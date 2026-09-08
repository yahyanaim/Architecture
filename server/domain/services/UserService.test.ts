import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from './UserService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import { ITokenStore } from '../../domain/interfaces/ITenant';

// Minimal token-store double: invite creation only needs createAuthToken.
const fakeTokens = {
  async createAuthToken(input: any) {
    return { id: 't1', usedAt: null, createdAt: new Date(), meta: {}, ...input };
  },
} as unknown as ITokenStore;

const ORG = 'org-test';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    userService = new UserService(userRepository, fakeTokens);
  });

  describe('createUser', () => {
    it('creates an invite (login-disabled account + single-use token)', async () => {
      const { user, inviteToken } = await userService.createUser('John Doe', 'john@example.com', ORG);

      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@example.com');
      expect(user.orgId).toBe(ORG);
      expect(user.isVerified).toBe(false);
      expect(inviteToken.length).toBeGreaterThan(20);
    });

    it('throws BusinessException if email already exists', async () => {
      await userService.createUser('John Doe', 'john@example.com', ORG);

      await expect(
        userService.createUser('Jane Doe', 'john@example.com', ORG)
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('toggleUserStatus', () => {
    it('toggles user active status from true to false', async () => {
      const { user } = await userService.createUser('John Doe', 'john@example.com', ORG);
      expect(user.isActive).toBe(true);

      const toggled = await userService.toggleUserStatus(user.id, ORG);
      expect(toggled.isActive).toBe(false);
    });

    it('toggles user active status from false to true', async () => {
      const { user } = await userService.createUser('John Doe', 'john@example.com', ORG);
      await userService.toggleUserStatus(user.id, ORG);

      const toggled = await userService.toggleUserStatus(user.id, ORG);
      expect(toggled.isActive).toBe(true);
    });

    it('throws NotFoundException if user does not exist', async () => {
      await expect(
        userService.toggleUserStatus('non-existent-id', ORG)
      ).rejects.toThrow('User not found');
    });

    it('throws NotFoundException for a user in another org (no id oracle)', async () => {
      const { user } = await userService.createUser('John Doe', 'john@example.com', 'org-other');

      await expect(
        userService.toggleUserStatus(user.id, ORG)
      ).rejects.toThrow('User not found');
      // Target untouched by the cross-tenant attempt.
      expect((await userRepository.findById(user.id))?.isActive).toBe(true);
    });
  });

  describe('deleteUser', () => {
    it('deletes an existing user', async () => {
      const { user } = await userService.createUser('John Doe', 'john@example.com', ORG);
      await userService.deleteUser(user.id, ORG);

      const found = await userRepository.findById(user.id);
      expect(found).toBeNull();
    });

    it('throws NotFoundException if user does not exist', async () => {
      await expect(
        userService.deleteUser('non-existent-id', ORG)
      ).rejects.toThrow('User not found');
    });

    it('refuses to delete a user in another org', async () => {
      const { user } = await userService.createUser('John Doe', 'john@example.com', 'org-other');

      await expect(
        userService.deleteUser(user.id, ORG)
      ).rejects.toThrow('User not found');
      expect(await userRepository.findById(user.id)).not.toBeNull();
    });
  });

  describe('getAllUsers', () => {
    it('returns only users of the requesting org (tenancy)', async () => {
      await userService.createUser('John Doe', 'john@example.com', ORG);
      await userService.createUser('Jane Doe', 'jane@example.com', 'org-other');

      const users = await userService.getAllUsers(ORG);
      expect(users).toHaveLength(1);
      expect(users[0]!.email).toBe('john@example.com');
    });

    it('returns empty array when org has no users', async () => {
      const users = await userService.getAllUsers(ORG);
      expect(users).toHaveLength(0);
    });
  });
});
