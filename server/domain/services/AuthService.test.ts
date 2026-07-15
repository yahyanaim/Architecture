import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './AuthService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: InMemoryUserRepository;
  const testSecret = 'test-secret-key-for-testing-only';

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    // Create a new AuthService with the test secret
    authService = new AuthService(userRepository, testSecret);
  });

  describe('register', () => {
    it('creates a new user and returns a token', async () => {
      const result = await authService.register('John Doe', 'john@example.com', 'password123');

      expect(result.user.name).toBe('John Doe');
      expect(result.user.email).toBe('john@example.com');
      expect(result.token).toBeDefined();
    });

    it('throws BusinessException if email already exists', async () => {
      await authService.register('John Doe', 'john@example.com', 'password123');

      await expect(
        authService.register('Jane Doe', 'john@example.com', 'password456')
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('login', () => {
    it('returns user and token on successful login', async () => {
      await authService.register('John Doe', 'john@example.com', 'password123');

      const result = await authService.login('john@example.com', 'password123');

      expect(result.user.email).toBe('john@example.com');
      expect(result.token).toBeDefined();
    });

    it('throws BusinessException for invalid email', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'password123')
      ).rejects.toThrow('Invalid email or password');
    });

    it('throws BusinessException for invalid password', async () => {
      await authService.register('John Doe', 'john@example.com', 'correctpassword');

      await expect(
        authService.login('john@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('verifyToken', () => {
    it('verifies a valid token', async () => {
      const { token } = await authService.register('John Doe', 'john@example.com', 'password123');

      const payload = authService.verifyToken(token);

      expect(payload.email).toBe('john@example.com');
    });

    it('throws BusinessException for invalid token', async () => {
      expect(() => authService.verifyToken('invalid-token')).toThrow('Invalid or expired token');
    });
  });

  describe('getUserById', () => {
    it('returns user by id', async () => {
      const { user } = await authService.register('John Doe', 'john@example.com', 'password123');

      const found = await authService.getUserById(user.id);

      expect(found).not.toBeNull();
      expect(found?.email).toBe('john@example.com');
    });

    it('returns null for non-existent id', async () => {
      const found = await authService.getUserById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('role assignment', () => {
    it('assigns admin role to first user', async () => {
      const result = await authService.register('First User', 'first@example.com', 'password123');
      expect(result.user.role).toBe('admin');
    });

    it('assigns user role to subsequent users', async () => {
      // Create first user
      await authService.register('First User', 'first@example.com', 'password123');
      
      // Create second user
      const result = await authService.register('Second User', 'second@example.com', 'password123');
      expect(result.user.role).toBe('user');
    });
  });
});
