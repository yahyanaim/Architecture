import { Router } from 'express';
import { MeController } from '../controllers/MeController';
import { ProfileService } from '../../domain/services/ProfileService';
import { userRepository, tokenStore, jobQueue } from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';

const router = Router();

const profileService = new ProfileService(userRepository, tokenStore, jobQueue);
const meController = new MeController(profileService);
const requireActiveUser = createRequireActiveUser(userRepository);

// GDPR Compliance endpoints
router.get('/export', authenticate, requireActiveUser, resolveTenant, meController.exportData);
router.delete('/purge', authenticate, requireActiveUser, resolveTenant, meController.purgeAccount);

// CSRF token retrieval helper
router.get('/csrf', meController.getCsrf);

export { router as meRoutes };
