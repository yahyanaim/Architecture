import crypto from 'crypto';
import { ITotpService } from '../../domain/interfaces/ITotpService';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | (buffer[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31] ?? '';
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31] ?? '';
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean.charAt(i);
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export class TotpService implements ITotpService {
  generateSecret(byteLength = 20): string {
    const buffer = crypto.randomBytes(byteLength);
    return base32Encode(buffer);
  }

  generateTotpUri(email: string, issuer: string, secret: string): string {
    const encIssuer = encodeURIComponent(issuer);
    const encEmail = encodeURIComponent(email);
    return `otpauth://totp/${encIssuer}:${encEmail}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  generateTotpCode(secret: string, timestamp: number = Date.now()): string {
    const secretBuffer = base32Decode(secret);
    const step = 30;
    const counter = Math.floor(timestamp / 1000 / step);

    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', secretBuffer).update(timeBuffer).digest();
    const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
    const b0 = hmac[offset] ?? 0;
    const b1 = hmac[offset + 1] ?? 0;
    const b2 = hmac[offset + 2] ?? 0;
    const b3 = hmac[offset + 3] ?? 0;

    const binary =
      ((b0 & 0x7f) << 24) |
      ((b1 & 0xff) << 16) |
      ((b2 & 0xff) << 8) |
      (b3 & 0xff);

    const code = (binary % 1_000_000).toString().padStart(6, '0');
    return code;
  }

  verifyToken(secret: string, token: string, window = 1): boolean {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.trim();
    if (cleanToken.length !== 6) return false;

    const now = Date.now();
    const stepMs = 30 * 1000;

    for (let i = -window; i <= window; i++) {
      const expected = this.generateTotpCode(secret, now + i * stepMs);
      if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
        return true;
      }
    }

    return false;
  }

  generateRecoveryCodes(count = 8): { plain: string[]; hashed: string[] } {
    const plain: string[] = [];
    const hashed: string[] = [];

    for (let i = 0; i < count; i++) {
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const code = `${part1}-${part2}`;
      plain.push(code);

      const hash = this.hashRecoveryCode(code);
      hashed.push(hash);
    }

    return { plain, hashed };
  }

  private hashRecoveryCode(code: string): string {
    const normalized = code.replace(/[\s-]/g, '').toUpperCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  verifyRecoveryCode(
    plain: string,
    hashedCodes: string[]
  ): { valid: boolean; remainingHashed: string[] } {
    const targetHash = this.hashRecoveryCode(plain);
    const index = hashedCodes.indexOf(targetHash);
    if (index === -1) {
      return { valid: false, remainingHashed: hashedCodes };
    }

    const remaining = [...hashedCodes];
    remaining.splice(index, 1);
    return { valid: true, remainingHashed: remaining };
  }
}

export const defaultTotpService = new TotpService();
