import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../domain/services/AuthService';
import { AuthRequest } from '../middleware/authenticate';
import { RegisterSchema, LoginSchema } from '../dtos/AuthDTO';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { audit } from '../../infrastructure/audit';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

export class AuthController {
  constructor(private readonly authService: AuthService) { }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = RegisterSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationException('Invalid input data', parseResult.error.format());
      }

      const { name, email, password } = parseResult.data;
      const result = await this.authService.register(name, email, password);

      res.cookie('token', result.token, COOKIE_OPTIONS);
      audit('user.registered', result.user.id, { email: result.user.email, role: result.user.role });
      res.status(201).json({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = LoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationException('Invalid input data', parseResult.error.format());
      }

      const { email, password } = parseResult.data;
      const result = await this.authService.login(email, password);

      res.cookie('token', result.token, COOKIE_OPTIONS);
      res.status(200).json({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.clearCookie('token', { path: '/' });
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const fullUser = await this.authService.getUserById(authReq.user.userId);

      if (!fullUser) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json({
        id: fullUser.id,
        name: fullUser.name,
        email: fullUser.email,
        role: fullUser.role,
      });
    } catch (error) {
      next(error);
    }
  };
}
