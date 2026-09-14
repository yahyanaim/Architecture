import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../../domain/services/AuthService';
import { OAuthService } from '../../domain/services/OAuthService';
import { DefaultOAuthProviderClient } from '../../infrastructure/oauth/OAuthProviderClient';
import {
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
  membershipRepository,
  twoFactorRepository,
  totpService,
  jobQueue,
  oauthAccountRepository,
  tokenService,
} from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { loginAccountLimiter } from '../middleware/loginAccountLimiter';
import {
  APP_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
} from '../../config/index';

const router = Router();

// IP-level throttle: 5 auth attempts / 15 min per IP (brute-force floor).
// Credential endpoints ALSO carry `loginAccountLimiter` (per-account bucket)
// because IP limits don't stop distributed guessing. Both must trip before
// the controller runs — order: ipLimiter -> accountLimiter -> handler.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many auth attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// SIGNUP ABUSE THROTTLE (separate, stricter): registration mints a whole
// workspace (org + subscription row), so bot signups are far more expensive
// than failed logins. 3 new orgs / hour / IP. Legitimate users never notice;
// signup farms hit a wall. (Longer-term: CAPTCHA or verification-before-use
// on top — see `requireVerified`, currently opt-in per route.)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many accounts created from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Session + single-use flows need the full port set (users, orgs,
// subscriptions, tokens). Wired once here — the composition root for auth.
const authService = new AuthService(
  userRepository,
  orgRepository,
  billingRepository,
  tokenStore,
  undefined,
  membershipRepository,
  twoFactorRepository,
  totpService
);

const oauthProviderClient = new DefaultOAuthProviderClient(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET
);

const oauthService = new OAuthService(
  userRepository,
  orgRepository,
  billingRepository,
  membershipRepository,
  oauthAccountRepository,
  authService,
  oauthProviderClient,
  twoFactorRepository,
  tokenService,
  {
    appUrl: APP_URL,
    googleClientId: GOOGLE_CLIENT_ID,
    githubClientId: GITHUB_CLIENT_ID,
  }
);

const requireActiveUser = createRequireActiveUser(userRepository);
const authController = new AuthController(authService, jobQueue, oauthService);

router.post('/register', registerLimiter, authController.register);
router.post('/login', authLimiter, loginAccountLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
// `me` is liveness-checked so deleted/deactivated accounts can't poll it.
router.get('/me', authenticate, requireActiveUser, authController.me);

// OAuth 2.0 / OIDC (Google & GitHub)
router.get('/oauth/:provider/url', authController.getOAuthUrl);
router.get('/oauth/:provider/callback', authController.oauthCallback);
router.post('/oauth/:provider/callback', authController.oauthCallback);
router.get('/oauth/callback', authController.oauthCallback);
router.post('/oauth/callback', authController.oauthCallback);

// Two-Factor Authentication (2FA / TOTP)
router.post('/2fa/verify', authLimiter, authController.verify2Fa);
router.post('/2fa/setup', authenticate, requireActiveUser, authController.setup2Fa);
router.post('/2fa/enable', authenticate, requireActiveUser, authController.enable2Fa);
router.post('/2fa/disable', authenticate, requireActiveUser, authController.disable2Fa);

// Email verification (enumeration-safe: always 200, see service).
router.post('/verify-request', authLimiter, authController.requestVerification);
router.get('/verify', authController.verify);

// Password reset (enumeration-safe; reset kills all sessions).
router.post('/password-reset-request', authLimiter, authController.requestPasswordReset);
router.post('/password-reset', authLimiter, authController.resetPassword);

// Org invite acceptance (sets password + verifies + auto-login).
router.post('/invite-accept', authLimiter, authController.acceptInvite);

export { router as authRoutes };

