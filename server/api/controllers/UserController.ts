import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../domain/services/UserService';
import { CreateUserSchema, UserResponseDTO } from '../dtos/UserDTO';
import { ValidationException } from '../../domain/exceptions/ValidationException';

export class UserController {
  constructor(private readonly userService: UserService) { }

  createUser = async (req: Request, res: Response, next: NextFunction) => {
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
        isActive: user.isActive
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.userService.getAllUsers();

      const response: UserResponseDTO[] = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        isActive: user.isActive
      }));

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  toggleStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await this.userService.toggleUserStatus(id);

      const response: UserResponseDTO = {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        isActive: user.isActive
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.userService.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
