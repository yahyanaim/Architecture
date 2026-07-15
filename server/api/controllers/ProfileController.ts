import { Request, Response, NextFunction } from 'express';
import { ProfileService } from '../../domain/services/ProfileService';
import { AuthRequest } from '../middleware/authenticate';
import { UpdateProfileSchema, ChangePasswordSchema, ProfileResponseDTO } from '../dtos/ProfileDTO';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { audit } from '../../infrastructure/audit';

export class ProfileController {
  constructor(private readonly profileService: ProfileService) { }

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
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
      const authReq = req as AuthRequest;
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
      const authReq = req as AuthRequest;
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
      const authReq = req as AuthRequest;
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

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  };
}