export interface ITotpService {
  generateSecret(length?: number): string;
  generateTotpUri(email: string, issuer: string, secret: string): string;
  generateTotpCode(secret: string, timestamp?: number): string;
  verifyToken(secret: string, token: string, window?: number): boolean;
  generateRecoveryCodes(count?: number): { plain: string[]; hashed: string[] };
  verifyRecoveryCode(plain: string, hashedCodes: string[]): { valid: boolean; remainingHashed: string[] };
}
