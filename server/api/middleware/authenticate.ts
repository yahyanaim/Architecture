import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/index';
import { BusinessException } from '../../domain/exceptions/BusinessException';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'admin' | 'user';
  };
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;

    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      throw new BusinessException('No token provided');
    }

    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: 'admin' | 'user' };

    (req as AuthRequest).user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new BusinessException('Invalid token'));
    } else {
      next(error);
    }
  }
};
