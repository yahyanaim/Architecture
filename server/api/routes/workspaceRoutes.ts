import { Router } from 'express';
import { WorkspaceController } from '../controllers/WorkspaceController';
import {
  membershipRepository,
  orgRepository,
  subscriptionRepository,
  userRepository,
} from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';

const router = Router();
const requireActiveUser = createRequireActiveUser(userRepository);
const workspaceController = new WorkspaceController(
  membershipRepository,
  orgRepository,
  subscriptionRepository
);

router.get('/', authenticate, requireActiveUser, resolveTenant, workspaceController.listWorkspaces);
router.post('/', authenticate, requireActiveUser, resolveTenant, workspaceController.createWorkspace);

export default router;
