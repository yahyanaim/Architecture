import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { User } from '../../server/domain/entities/User';
import { defaultPasswordHasher } from '../../server/infrastructure/security/BcryptPasswordHasher';
import { AuthService } from '../../server/domain/services/AuthService';
import { defaultTokenService } from '../../server/infrastructure/security/JwtTokenService';

process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

User.setDefaultHasher(defaultPasswordHasher);
AuthService.setDefaultTokenService(defaultTokenService);

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});
