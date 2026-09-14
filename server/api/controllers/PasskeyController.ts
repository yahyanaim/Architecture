import { Request, Response, NextFunction } from 'express';
import { PasskeyService } from '../../domain/services/PasskeyService';
import { ActiveUserRequest } from '../middleware/requireActiveUser';
import { IS_PROD, ACCESS_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_MAX_AGE_MS } from '../../config/index';
import { SessionTokens } from '../../domain/services/AuthService';

const ACCESS_COOKIE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  maxAge: ACCESS_COOKIE_MAX_AGE_MS,
  path: '/',
};

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  path: '/',
};

const CHALLENGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  maxAge: 5 * 60 * 1000, // 5 minutes
  path: '/',
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  path: '/',
};

export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  private setSession(res: Response, tokens: SessionTokens): void {
    res.cookie('access', tokens.access, ACCESS_COOKIE);
    res.cookie('refresh', tokens.refresh, REFRESH_COOKIE);
  }

  getRegistrationOptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as ActiveUserRequest).account;
      if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const options = await this.passkeyService.generateRegistrationOptions(user);
      res.cookie('passkey_reg_challenge', options.challenge, CHALLENGE_COOKIE_OPTIONS);
      res.json(options);
    } catch (err) {
      next(err);
    }
  };

  verifyRegistration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as ActiveUserRequest).account;
      if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const expectedChallenge = req.cookies?.passkey_reg_challenge;
      if (!expectedChallenge) {
        res.status(400).json({ message: 'Missing or expired passkey registration challenge' });
        return;
      }
      res.clearCookie('passkey_reg_challenge', CLEAR_COOKIE_OPTIONS);

      const { response, name } = req.body;
      if (!response) {
        res.status(400).json({ message: 'Missing passkey registration response' });
        return;
      }

      const credential = await this.passkeyService.verifyRegistration(
        user,
        response,
        expectedChallenge,
        name
      );

      res.status(201).json({
        verified: true,
        credential: {
          id: credential.id,
          name: credential.name,
          deviceType: credential.deviceType,
          backedUp: credential.backedUp,
          createdAt: credential.createdAt,
          lastUsedAt: credential.lastUsedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getAuthenticationOptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = typeof req.query.email === 'string' ? req.query.email : undefined;
      const options = await this.passkeyService.generateAuthenticationOptions(email);
      res.cookie('passkey_auth_challenge', options.challenge, CHALLENGE_COOKIE_OPTIONS);
      res.json(options);
    } catch (err) {
      next(err);
    }
  };

  verifyAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const expectedChallenge = req.cookies?.passkey_auth_challenge;
      if (!expectedChallenge) {
        res.status(400).json({ message: 'Missing or expired passkey authentication challenge' });
        return;
      }
      res.clearCookie('passkey_auth_challenge', CLEAR_COOKIE_OPTIONS);

      const { response } = req.body;
      if (!response) {
        res.status(400).json({ message: 'Missing passkey authentication response' });
        return;
      }

      const result = await this.passkeyService.verifyAuthentication(
        response,
        expectedChallenge,
        req.ip
      );

      this.setSession(res, result.tokens);

      res.json({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        emailVerified: result.user.isVerified,
        orgId: result.org.id,
      });
    } catch (err) {
      next(err);
    }
  };

  listCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authUser = (req as ActiveUserRequest).user;
      if (!authUser) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const credentials = await this.passkeyService.listCredentials(authUser.userId);
      res.json(
        credentials.map((c) => ({
          id: c.id,
          name: c.name,
          deviceType: c.deviceType,
          backedUp: c.backedUp,
          createdAt: c.createdAt,
          lastUsedAt: c.lastUsedAt,
        }))
      );
    } catch (err) {
      next(err);
    }
  };

  deleteCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authUser = (req as ActiveUserRequest).user;
      if (!authUser) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: 'Credential ID required' });
        return;
      }
      await this.passkeyService.deleteCredential(id, authUser.userId);
      res.json({ success: true, message: 'Passkey deleted' });
    } catch (err) {
      next(err);
    }
  };
}
