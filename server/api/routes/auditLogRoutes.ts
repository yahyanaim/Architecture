import { Router } from 'express';
import { AuditLogController } from '../controllers/AuditLogController';
import {
  auditLogRepository,
  userRepository,
  membershipRepository,
} from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';
import { authorizeAdmin } from '../middleware/authorize';

const router = Router();
const auditLogController = new AuditLogController(auditLogRepository);

const requireActiveUser = createRequireActiveUser(userRepository);

router.get('/', authenticate, requireActiveUser, resolveTenant, authorizeAdmin, auditLogController.query);

export { router as auditLogRoutes };
