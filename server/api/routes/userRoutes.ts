import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { UserService } from '../../domain/services/UserService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import { NeonUserRepository } from '../../infrastructure/repositories/NeonUserRepository';
import { sql } from '../../infrastructure/neon';

const router = Router();

// ==========================================
// Inversion of Control (IoC) Wiring
// Manual Dependency Injection Setup
// ==========================================

// 1. Instantiate the Repository (Infrastructure Layer)
// Automatically switch to Neon if DATABASE_URL is provided
const userRepository = sql
    ? new NeonUserRepository()
    : new InMemoryUserRepository();

// 2. Instantiate the Service (Domain Layer)
const userService = new UserService(userRepository);

// 3. Instantiate the Controller (API Layer)
const userController = new UserController(userService);

// ==========================================
// Route Definitions
// ==========================================

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
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
 */
router.post('/', userController.createUser);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', userController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Toggle user active status
 *     tags: [Users]
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
 */
router.patch('/:id/status', userController.toggleStatus);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
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
 */
router.delete('/:id', userController.deleteUser);

export { router as userRoutes };
