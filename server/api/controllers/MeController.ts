import { Request, Response, NextFunction } from 'express';
import { ProfileService } from '../../domain/services/ProfileService';
import { ActiveUserRequest } from '../middleware/requireActiveUser';
import { IS_PROD } from '../../config/index';

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  path: '/',
};

export class MeController {
  constructor(private readonly profileService: ProfileService) {}

  exportData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as ActiveUserRequest;
      if (!authReq.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const dump = await this.profileService.exportUserData(authReq.user.userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${authReq.user.userId}.json"`);
      res.json(dump);
    } catch (error) {
      next(error);
    }
  };

  purgeAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as ActiveUserRequest;
      if (!authReq.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const result = await this.profileService.purgeAccount(authReq.user.userId);

      // Kill active cookie sessions on client
      res.clearCookie('access', CLEAR_COOKIE_OPTIONS);
      res.clearCookie('refresh', CLEAR_COOKIE_OPTIONS);
      res.clearCookie('token', CLEAR_COOKIE_OPTIONS);

      res.json({
        message: 'Account soft-deleted and scheduled for permanent purge in 30 days. Active sessions terminated and audit logs anonymized.',
        purgeDueAt: result.purgeDueAt,
      });
    } catch (error) {
      next(error);
    }
  };

  getCsrf = async (req: Request, res: Response): Promise<void> => {
    const token = (res.locals.csrfToken as string) || req.cookies?.csrf_token || req.cookies?.['XSRF-TOKEN'];
    res.json({ csrfToken: token });
  };
}
