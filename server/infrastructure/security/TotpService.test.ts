import { describe, it, expect } from 'vitest';
import { TotpService } from './TotpService';

describe('TotpService', () => {
  const service = new TotpService();

  it('generates valid Base32 secret', () => {
    const secret = service.generateSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('generates standard otpauth URI', () => {
    const secret = service.generateSecret();
    const uri = service.generateTotpUri('user@example.com', 'Acme Corp', secret);
    expect(uri).toContain('otpauth://totp/Acme%20Corp:user%40example.com');
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('generates and verifies TOTP code within valid time window', () => {
    const secret = service.generateSecret();
    const now = Date.now();
    const code = service.generateTotpCode(secret, now);

    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);

    // Current time
    expect(service.verifyToken(secret, code)).toBe(true);

    // Within ±30s window
    const codePast = service.generateTotpCode(secret, now - 30_000);
    expect(service.verifyToken(secret, codePast)).toBe(true);

    // Outside window (e.g. 5 minutes ago)
    const codeExpired = service.generateTotpCode(secret, now - 300_000);
    expect(service.verifyToken(secret, codeExpired)).toBe(false);

    // Invalid codes
    expect(service.verifyToken(secret, '000000')).toBe(false);
    expect(service.verifyToken(secret, 'invalid')).toBe(false);
  });

  it('generates and verifies single-use recovery codes', () => {
    const { plain, hashed } = service.generateRecoveryCodes(4);
    expect(plain).toHaveLength(4);
    expect(hashed).toHaveLength(4);

    const firstCode = plain[0]!;
    const res1 = service.verifyRecoveryCode(firstCode, hashed);
    expect(res1.valid).toBe(true);
    expect(res1.remainingHashed).toHaveLength(3);

    // Reusing the same code must fail against remaining list
    const res2 = service.verifyRecoveryCode(firstCode, res1.remainingHashed);
    expect(res2.valid).toBe(false);
    expect(res2.remainingHashed).toHaveLength(3);
  });
});
