import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { UserService } from '../../domain/services/UserService';
import { userRepository, tokenStore, jobQueue } from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';
import { authorizeAdmin } from '../middleware/authorize';

const router = Router();

// ==========================================
// Inversion of Control (IoC) Wiring
// Manual Dependency Injection Setup
// ==========================================

// 1. Use the shared repository singleton so that auth and user routes operate on the same data store.

// 2. Instantiate the Service (Domain Layer)
// Injecting the repository via constructor
const userService = new UserService(userRepository, tokenStore);

// 2b. Session-liveness guard. `authenticate` verifies the JWT signature only;
// `requireActiveUser` re-checks the account against the repository on every
// request so deactivated/deleted users lose access immediately instead of
// keeping a valid token until expiry. Injected with the same singleton.
const requireActiveUser = createRequireActiveUser(userRepository);

// 3. Instantiate the Controller (API Layer)
// Injecting the service + job queue (invite emails) via constructor
const userController = new UserController(userService, jobQueue);

// ==========================================
// Route Definitions
// POLICY: user management is admin-only. Every route here chains
// `authenticate` (who is calling?) -> `requireActiveUser` (is the account
// still live?) -> `resolveTenant` (which workspace?) -> `authorizeAdmin`
// (is it an admin?) before the controller. `GET /` intentionally requires
// admin too: the payload contains every account's name/email/role, which is
// PII enumeration for regular users. All data access below is org-scoped.
// ==========================================

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation or Business error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: 'Forbidden: Admin access required'
 */
router.post('/', authenticate, requireActiveUser, resolveTenant, authorizeAdmin, userController.createUser);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, requireActiveUser, resolveTenant, authorizeAdmin, userController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Toggle user active status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User status toggled
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.patch('/:id/status', authenticate, requireActiveUser, resolveTenant, authorizeAdmin, userController.toggleStatus);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', authenticate, requireActiveUser, resolveTenant, authorizeAdmin, userController.deleteUser);

export { router as userRoutes };

