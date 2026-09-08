import { Router } from 'express';
import { ProfileController } from '../controllers/ProfileController';
import { ProfileService } from '../../domain/services/ProfileService';
import { AuthService } from '../../domain/services/AuthService';
import { userRepository, orgRepository, billingRepository, tokenStore } from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';

const router = Router();

const profileService = new ProfileService(userRepository, tokenStore);
// AuthService here only mints the replacement session after a password
// change (which revokes all sessions) — profile logic stays in ProfileService.
const authService = new AuthService(userRepository, orgRepository, billingRepository, tokenStore);
const profileController = new ProfileController(profileService, authService);

// See `userRoutes.ts`: `authenticate` proves the token signature, but only
// `requireActiveUser` proves the account still exists and is active. Profile
// self-service must enforce both, otherwise a deactivated user could keep
// reading/updating their profile until the JWT expires.
const requireActiveUser = createRequireActiveUser(userRepository);

router.get('/', authenticate, requireActiveUser, resolveTenant, profileController.getProfile);
router.put('/', authenticate, requireActiveUser, resolveTenant, profileController.updateProfile);
router.put('/password', authenticate, requireActiveUser, resolveTenant, profileController.changePassword);
router.delete('/', authenticate, requireActiveUser, resolveTenant, profileController.deleteAccount);

export { router as profileRoutes };