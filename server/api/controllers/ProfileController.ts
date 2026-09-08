import { Request, Response, NextFunction } from 'express';
import { ProfileService } from '../../domain/services/ProfileService';
import { AuthService, ACCESS_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_MAX_AGE_MS } from '../../domain/services/AuthService';
import { ActiveUserRequest } from '../middleware/requireActiveUser';
import { UpdateProfileSchema, ChangePasswordSchema, ProfileResponseDTO } from '../dtos/ProfileDTO';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { audit } from '../../infrastructure/audit';

export class ProfileController {
  // `authService` is used ONLY to mint the caller's replacement session after
  // a password change revokes every session (including theirs). All profile
  // rules stay in `ProfileService`.
  constructor(private readonly profileService: ProfileService, private readonly authService: AuthService) { }

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as ActiveUserRequest;
      if (!authReq.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const user = await this.profileService.getProfile(authReq.user.userId);

      const response: ProfileResponseDTO = {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as ActiveUserRequest;
      if (!authReq.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parseResult = UpdateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationException('Invalid input data', parseResult.error.format());
      }

      const user = await this.profileService.updateProfile(authReq.user.userId, parseResult.data);

      const response: ProfileResponseDTO = {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as ActiveUserRequest;
      if (!authReq.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      await this.profileService.deleteAccount(authReq.user.userId);
      audit('user.account_deleted', authReq.user.userId);
      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as ActiveUserRequest;
      if (!authReq.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parseResult = ChangePasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationException('Invalid input', parseResult.error.format());
      }

      const { currentPassword, newPassword } = parseResult.data;
      await this.profileService.changePassword(authReq.user.userId, currentPassword, newPassword);
      // Password change revoked ALL sessions (including this one) — mint the
      // caller's replacement pair so they stay logged in; every other device
      // must re-authenticate.
      const tokens = await this.authService.issueSession(authReq.user.userId, authReq.account ?? null, req.ip);
      const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
      res.cookie('access', tokens.access, { ...base, maxAge: ACCESS_COOKIE_MAX_AGE_MS });
      res.cookie('refresh', tokens.refresh, { ...base, maxAge: REFRESH_COOKIE_MAX_AGE_MS });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  };
}