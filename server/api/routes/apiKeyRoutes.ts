import { Router } from 'express';
import { ApiKeyController } from '../controllers/ApiKeyController';
import { ApiKeyService } from '../../domain/services/ApiKeyService';
import {
  apiKeyRepository,
  userRepository,
  membershipRepository,
} from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';

const router = Router();
const apiKeyService = new ApiKeyService(apiKeyRepository);
const apiKeyController = new ApiKeyController(apiKeyService);

const requireActiveUser = createRequireActiveUser(userRepository);

router.get('/', authenticate, requireActiveUser, resolveTenant, apiKeyController.list);
router.post('/', authenticate, requireActiveUser, resolveTenant, apiKeyController.create);
router.delete('/:id', authenticate, requireActiveUser, resolveTenant, apiKeyController.revoke);

export { router as apiKeyRoutes };
