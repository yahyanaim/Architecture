import { Request, Response, NextFunction } from 'express';
import { AuthService, ACCESS_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_MAX_AGE_MS, SessionTokens } from '../../domain/services/AuthService';
import { ActiveUserRequest } from '../middleware/requireActiveUser';
import {
  RegisterSchema, LoginSchema, EmailRequestSchema, ResetPasswordSchema, InviteAcceptSchema,
  AuthResponseDTO,
} from '../dtos/AuthDTO';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { audit } from '../../infrastructure/audit';
import { JobQueue } from '../../infrastructure/queue';
import { APP_URL } from '../../config/index';

// Cookie lifecycle: short-lived `access` JWT + long-lived opaque `refresh`.
// Both httpOnly (never JS-readable), `secure` in prod, `sameSite: lax`.
// Flags must match between set and clear or browsers keep the cookie.
const ACCESS_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: ACCESS_COOKIE_MAX_AGE_MS,
  path: '/',
};

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  path: '/',
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function toResponse(id: string, name: string, email: string, role: 'admin' | 'user', emailVerified: boolean, orgId: string): AuthResponseDTO {
  return { id, name, email, role, emailVerified, orgId };
}

export class AuthController {
  // `jobQueue` delivers verify/reset/invite emails asynchronously — HTTP
  // responses never wait on mail delivery (enqueue + return).
  constructor(private readonly authService: AuthService, private readonly jobQueue: JobQueue) { }

  private setSession(res: Response, tokens: SessionTokens): void {
    res.cookie('access', tokens.access, ACCESS_COOKIE);
    res.cookie('refresh', tokens.refresh, REFRESH_COOKIE);
  }

  private clearSession(res: Response): void {
    res.clearCookie('access', CLEAR_COOKIE_OPTIONS);
    res.clearCookie('refresh', CLEAR_COOKIE_OPTIONS);
    res.clearCookie('token', CLEAR_COOKIE_OPTIONS); // legacy pre-split cookie
  }

  private enqueueEmail(to: string, subject: string, text: string, kind: 'verify' | 'reset' | 'invite' | 'welcome'): void {
    // Fire-and-forget: a queue failure must not fail registration/login.
    // Unhandled rejections are contained here, never in the request path.
    this.jobQueue.enqueue('email.send', { to, subject, text, kind }).catch(() => undefined);
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = RegisterSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationException('Invalid input data', parseResult.error.format());
      }

      const { name, email, password } = parseResult.data;
      const result = await this.authService.register(name, email, password);

      this.setSession(res, result.tokens);
      this.enqueueEmail(
        result.user.email,
        'Verify your email',
        `Welcome ${result.user.name}! Verify your email: ${APP_URL}/api/auth/verify?token=${result.verifyToken}`,
        'verify'
      );
      audit('user.registered', result.user.id, { email: result.user.email, role: result.user.role, orgId: result.org.id });
      res.status(201).json(toResponse(
        result.user.id, result.user.name, result.user.email, result.user.role,
        result.user.isVerified, result.org.id
      ));
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
      const result = await this.authService.login(email, password, req.ip);

      if (result.mfaRequired) {
        res.status(200).json({
          mfaRequired: true,
          mfaToken: result.mfaToken,
        });
        return;
      }

      this.setSession(res, result.tokens!);
      res.status(200).json(toResponse(
        result.user!.id, result.user!.name, result.user!.email, result.user!.role,
        result.user!.isVerified, result.org!.id
      ));
    } catch (error) {
      next(error);
    }
  };

  /** Rotates the session pair. Reuse of an old refresh token => 400 + chain revoked. */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const presented = req.cookies?.refresh as string | undefined;
      if (!presented) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const result = await this.authService.refreshSession(presented, req.ip);
      this.setSession(res, result.tokens);
      res.status(200).json(toResponse(
        result.user.id, result.user.name, result.user.email, result.user.role,
        result.user.isVerified, result.org.id
      ));
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.logout(req.cookies?.refresh);
      this.clearSession(res);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as ActiveUserRequest;
      // Prefer the DB-hydrated account (liveness-checked) over the raw claim.
      const fullUser = authReq.account ?? (await this.authService.getUserById(authReq.user!.userId));

      if (!fullUser) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json(toResponse(
        fullUser.id, fullUser.name, fullUser.email, fullUser.role,
        fullUser.isVerified, fullUser.orgId
      ));
    } catch (error) {
      next(error);
    }
  };

  requestVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = EmailRequestSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationException('Invalid input data', parsed.error.format());
      // Always 200: the service returns null for unknown/already-verified
      // addresses so responses can't be used for email enumeration.
      const token = await this.authService.requestEmailVerification(parsed.data.email);
      if (token) {
        this.enqueueEmail(
          parsed.data.email, 'Verify your email',
          `Verify your email: ${APP_URL}/api/auth/verify?token=${token}`, 'verify'
        );
      }
      res.json({ message: 'If an unverified account exists for this email, a link was sent' });
    } catch (error) {
      next(error);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      if (!token) {
        res.status(400).json({ message: 'Verification token is required' });
        return;
      }
      const user = await this.authService.verifyEmail(token);
      audit('user.verified', user.id, { email: user.email });
      // Redirect (not JSON): this endpoint is opened from email links in a
      // browser. Landing on /login?verified=1 shows a confirmation banner;
      // API clients can still follow redirects or read the query result.
      res.redirect(`${APP_URL}/login?verified=1`);
    } catch (error) {
      next(error);
    }
  };

  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = EmailRequestSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationException('Invalid input data', parsed.error.format());
      const token = await this.authService.requestPasswordReset(parsed.data.email);
      if (token) {
        this.enqueueEmail(
          parsed.data.email, 'Reset your password',
          `Reset your password (valid 1 hour): ${APP_URL}/reset-password?token=${token}`, 'reset'
        );
      }
      res.json({ message: 'If an account exists for this email, a reset link was sent' });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ResetPasswordSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationException('Invalid input data', parsed.error.format());
      const user = await this.authService.resetPassword(parsed.data.token, parsed.data.newPassword);
      audit('user.password_reset', user.id, {});
      res.json({ message: 'Password changed successfully. All other sessions were revoked.' });
    } catch (error) {
      next(error);
    }
  };

  acceptInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = InviteAcceptSchema.safeParse(req.body);
      if (!parsed.success) throw new ValidationException('Invalid input data', parsed.error.format());
      const result = await this.authService.acceptInvite(parsed.data.token, parsed.data.password, parsed.data.name);
      this.setSession(res, result.tokens);
      audit('user.invite_accepted', result.user.id, { email: result.user.email, orgId: result.org.id });
      res.status(200).json(toResponse(
        result.user.id, result.user.name, result.user.email, result.user.role,
        result.user.isVerified, result.org.id
      ));
    } catch (error) {
      next(error);
    }
  };

  setup2Fa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as ActiveUserRequest;
      if (!r.account) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const data = await this.authService.setup2Fa(r.account.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  enable2Fa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as ActiveUserRequest;
      if (!r.account) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const { code } = req.body || {};
      if (!code || typeof code !== 'string') {
        throw new ValidationException('Validation failed', { code: 'Verification code is required' });
      }
      await this.authService.enable2Fa(r.account.id, code);
      audit('user.2fa_enabled', r.account.id, {});
      res.json({ message: 'Two-factor authentication enabled successfully' });
    } catch (error) {
      next(error);
    }
  };

  disable2Fa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as ActiveUserRequest;
      if (!r.account) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const { password, code } = req.body || {};
      if (!password || !code) {
        throw new ValidationException('Validation failed', { error: 'Password and verification code are required' });
      }
      await this.authService.disable2Fa(r.account.id, password, code);
      audit('user.2fa_disabled', r.account.id, {});
      res.json({ message: 'Two-factor authentication disabled successfully' });
    } catch (error) {
      next(error);
    }
  };

  verify2Fa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mfaToken, code } = req.body || {};
      if (!mfaToken || !code) {
        throw new ValidationException('Validation failed', { error: 'mfaToken and code are required' });
      }
      const result = await this.authService.verify2Fa(mfaToken, code, req.ip);
      this.setSession(res, result.tokens);
      audit('user.2fa_login', result.user.id, {});
      res.status(200).json(toResponse(
        result.user.id, result.user.name, result.user.email, result.user.role,
        result.user.isVerified, result.org.id
      ));
    } catch (error) {
      next(error);
    }
  };
}
