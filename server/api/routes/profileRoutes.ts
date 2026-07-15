import { Router } from 'express';
import { ProfileController } from '../controllers/ProfileController';
import { ProfileService } from '../../domain/services/ProfileService';
import { userRepository } from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';

const router = Router();

const profileService = new ProfileService(userRepository);
const profileController = new ProfileController(profileService);

router.get('/', authenticate, profileController.getProfile);
router.put('/', authenticate, profileController.updateProfile);
router.put('/password', authenticate, profileController.changePassword);
router.delete('/', authenticate, profileController.deleteAccount);

export { router as profileRoutes };