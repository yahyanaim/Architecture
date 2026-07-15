import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { UserService } from '../../domain/services/UserService';
import { userRepository } from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { authorizeAdmin } from '../middleware/authorize';

const router = Router();

// ==========================================
// Inversion of Control (IoC) Wiring
// Manual Dependency Injection Setup
// ==========================================

// 1. Use the shared repository singleton so that auth and user routes operate on the same data store.

// 2. Instantiate the Service (Domain Layer)
// Injecting the repository via constructor
const userService = new UserService(userRepository);

// 3. Instantiate the Controller (API Layer)
// Injecting the service via constructor
const userController = new UserController(userService);

// ==========================================
// Route Definitions
// All user management routes require authentication
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
router.post('/', authenticate, authorizeAdmin, userController.createUser);

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
router.get('/', authenticate, userController.getAllUsers);

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
router.patch('/:id/status', authenticate, authorizeAdmin, userController.toggleStatus);

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
router.delete('/:id', authenticate, authorizeAdmin, userController.deleteUser);

export { router as userRoutes };

