import { describe, it, expect } from 'vitest';
import { validatePassword, validateLoginPassword } from './password';

// Guards the client/backend contract: these messages must stay identical to
// server/api/dtos/AuthDTO.ts passwordSchema rejections.
describe('validatePassword', () => {
  it('rejects empty, short, and incomplete passwords', () => {
    expect(validatePassword('')).toBe('Password is required');
    expect(validatePassword('Ab1')).toBe('Password must be at least 8 characters');
    expect(validatePassword('lowercase1')).toBe('Password must contain an uppercase letter');
    expect(validatePassword('UPPERCASE1')).toBe('Password must contain a lowercase letter');
    expect(validatePassword('NoNumbers')).toBe('Password must contain a number');
  });

  it('accepts compliant passwords', () => {
    expect(validatePassword('Valid1234')).toBeNull();
  });
});

describe('validateLoginPassword', () => {
  it('requires non-empty only (strength enforced at set-time, not login)', () => {
    expect(validateLoginPassword('')).toBe('Password is required');
    expect(validateLoginPassword('x')).toBeNull();
    expect(validateLoginPassword('weak')).toBeNull();
  });
});
