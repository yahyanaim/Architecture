import { UserRole } from '../entities/User';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  orgId: string;
  purpose?: string;
}

/**
 * Token and crypto operations port interface.
 *
 * ARCHITECTURE (Hexagonal / Clean Architecture):
 * Isolates cryptographic tokens and JWT algorithms from domain services.
 */
export interface ITokenService {
  signAccessToken(payload: TokenPayload): string;
  verifyAccessToken(token: string): TokenPayload;
  generateRandomToken(bytes?: number): string;
  hashToken(token: string): string;
  slugify(name: string): string;
}
