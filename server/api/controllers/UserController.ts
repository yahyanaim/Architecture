import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../../domain/services/UserService';
import { CreateUserSchema, UserResponseDTO } from '../dtos/UserDTO';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { AuthRequest } from '../middleware/authenticate';
import { audit } from '../../infrastructure/audit';

const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

export class UserController {
  constructor(private readonly userService: UserService) { }

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = CreateUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationException('Invalid input data', parseResult.error.format());
      }

      const dto = parseResult.data;
      const user = await this.userService.createUser(dto.name, dto.email);

      const response: UserResponseDTO = {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        isActive: user.isActive,
        role: user.role
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.userService.getAllUsers();

      const response: UserResponseDTO[] = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        isActive: user.isActive,
        role: user.role
      }));

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = UuidParamSchema.safeParse(req.params);
      if (!parseResult.success) {
        throw new ValidationException('Invalid user ID', parseResult.error.format());
      }
      const { id } = parseResult.data;

      const user = await this.userService.toggleUserStatus(id);

      const response: UserResponseDTO = {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        isActive: user.isActive,
        role: user.role
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = UuidParamSchema.safeParse(req.params);
      if (!parseResult.success) {
        throw new ValidationException('Invalid user ID', parseResult.error.format());
      }
      const { id } = parseResult.data;

      const authReq = req as AuthRequest;
      await this.userService.deleteUser(id);
      audit('user.deleted', authReq.user?.userId ?? 'unknown', { targetUserId: id });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
