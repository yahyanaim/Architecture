import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import {
  webhookRepository,
  webhookDispatcher,
  jobQueue,
  userRepository,
} from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';

const router = Router();
const webhookController = new WebhookController(
  webhookRepository,
  webhookDispatcher,
  jobQueue
);

const requireActiveUser = createRequireActiveUser(userRepository);

router.get('/', authenticate, requireActiveUser, resolveTenant, webhookController.list);
router.post('/', authenticate, requireActiveUser, resolveTenant, webhookController.create);
router.get('/:id', authenticate, requireActiveUser, resolveTenant, webhookController.getById);
router.delete('/:id', authenticate, requireActiveUser, resolveTenant, webhookController.delete);
router.post('/:id/test', authenticate, requireActiveUser, resolveTenant, webhookController.testPing);
router.get('/:id/deliveries', authenticate, requireActiveUser, resolveTenant, webhookController.listDeliveries);
router.post('/deliveries/:deliveryId/replay', authenticate, requireActiveUser, resolveTenant, webhookController.replayDelivery);

export { router as webhookRoutes };
