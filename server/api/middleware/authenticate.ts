import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/index';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'admin' | 'user';
    orgId: string;
  };
}

// Verifies *who* is calling (JWT signature), not *whether they still may*.
// Stateless by design: accepts `Authorization: Bearer` (scripts/docs) or the
// httpOnly `access` cookie (SPA via `withCredentials`). The legacy `token`
// cookie is accepted as a fallback so sessions minted before the
// access/refresh split keep working until they expire. Account liveness
// (exists? active?) is enforced downstream by `requireActiveUser` — see it
// for why this split exists. Responds 401 directly (like `authorizeAdmin`'s
// 403) so auth failures have stable HTTP semantics for clients/proxies.
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.access ?? req.cookies?.token;

    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      // No credentials at all — 401 (not 400): the request is unauthenticated,
      // not malformed.
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: 'admin' | 'user';
      orgId: string;
      purpose?: string;
    };

    // Special-purpose tokens (e.g. 'mfa' pre-auth challenges) MUST NOT be accepted
    // as full session credentials on protected routes.
    if (payload.purpose) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    (req as AuthRequest).user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      // Bad signature / expired / malformed token — same 401 contract.
      res.status(401).json({ message: 'Unauthorized' });
    } else {
      next(error);
    }
  }
};
