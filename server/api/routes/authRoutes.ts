import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../../domain/services/AuthService';
import { userRepository } from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many auth attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Use the shared repository singleton — same store as userRoutes.
const authService = new AuthService(userRepository);
const authController = new AuthController(authService);

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

export { router as authRoutes };
