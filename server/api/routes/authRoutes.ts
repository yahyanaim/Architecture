import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../../domain/services/AuthService';
import { userRepository, orgRepository, billingRepository, tokenStore, jobQueue } from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { loginAccountLimiter } from '../middleware/loginAccountLimiter';

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

// Session + single-use flows need the full port set (users, orgs,
// subscriptions, tokens). Wired once here — the composition root for auth.
const authService = new AuthService(userRepository, orgRepository, billingRepository, tokenStore);
const requireActiveUser = createRequireActiveUser(userRepository);
const authController = new AuthController(authService, jobQueue);

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, loginAccountLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
// `me` is liveness-checked so deleted/deactivated accounts can't poll it.
router.get('/me', authenticate, requireActiveUser, authController.me);

// Email verification (enumeration-safe: always 200, see service).
router.post('/verify-request', authLimiter, authController.requestVerification);
router.get('/verify', authController.verify);

// Password reset (enumeration-safe; reset kills all sessions).
router.post('/password-reset-request', authLimiter, authController.requestPasswordReset);
router.post('/password-reset', authLimiter, authController.resetPassword);

// Org invite acceptance (sets password + verifies + auto-login).
router.post('/invite-accept', authLimiter, authController.acceptInvite);

export { router as authRoutes };
