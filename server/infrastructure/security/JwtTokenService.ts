import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ITokenService, TokenPayload } from '../../domain/interfaces/ITokenService';
import { JWT_SECRET, ACCESS_TOKEN_TTL } from '../../config/index';

export class JwtTokenService implements ITokenService {
  constructor(
    private readonly secret = JWT_SECRET,
    private readonly accessTtl = ACCESS_TOKEN_TTL
  ) {}

  signAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.accessTtl as jwt.SignOptions['expiresIn'] });
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.secret) as TokenPayload;
  }

  generateRandomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  slugify(name: string): string {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'workspace';
    return `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }
}

export const defaultTokenService = new JwtTokenService();
