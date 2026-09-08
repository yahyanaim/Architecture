import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../../domain/services/UserService';
import { CreateUserSchema, UserResponseDTO } from '../dtos/UserDTO';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { ActiveUserRequest } from '../middleware/requireActiveUser';
import { audit } from '../../infrastructure/audit';
import { JobQueue } from '../../infrastructure/queue';
import { APP_URL } from '../../config/index';

const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

export class UserController {
  // `jobQueue` delivers invite emails off the request path (see createUser).
  constructor(private readonly userService: UserService, private readonly jobQueue: JobQueue) { }

  // INVITE FLOW (tenant-scoped): validates input -> provisions an
  // login-disabled account in the CALLER's org (`req.tenant`, never client
  // input) -> enqueues the invite email with a single-use link -> 201.
  // Returns no secret: the plaintext invite token travels only via email.
  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantReq = req as ActiveUserRequest;
      if (!tenantReq.tenant) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const parseResult = CreateUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationException('Invalid input data', parseResult.error.format());
      }

      const dto = parseResult.data;
      const { user, inviteToken } = await this.userService.createUser(dto.name, dto.email, tenantReq.tenant.orgId);

      this.jobQueue.enqueue(
        'email.send',
        {
          to: user.email,
          subject: `You've been invited to join ${tenantReq.account?.name ?? 'a workspace'}`,
          text: `Hi ${user.name}, you've been invited. Set your password (valid 7 days): ${APP_URL}/invite?token=${inviteToken}`,
          kind: 'invite',
        }
      ).catch(() => undefined);
      audit('user.invited', tenantReq.account?.id ?? 'unknown', { targetUserId: user.id, orgId: tenantReq.tenant.orgId });

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

  getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Tenant-scoped: admins list their OWN org (see UserService).
      const tenantReq = req as ActiveUserRequest;
      if (!tenantReq.tenant) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const users = await this.userService.getAllUsers(tenantReq.tenant.orgId);

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
      // Tenant binding (see createUser): the service enforces target-in-org,
      // but the org itself must come from the server-side chain, not params.
      const tenantReq = req as ActiveUserRequest;
      if (!tenantReq.tenant) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const parseResult = UuidParamSchema.safeParse(req.params);
      if (!parseResult.success) {
        throw new ValidationException('Invalid user ID', parseResult.error.format());
      }
      const { id } = parseResult.data;

      const user = await this.userService.toggleUserStatus(id, tenantReq.tenant.orgId);

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
      const authReq = req as ActiveUserRequest;
      if (!authReq.tenant) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const parseResult = UuidParamSchema.safeParse(req.params);
      if (!parseResult.success) {
        throw new ValidationException('Invalid user ID', parseResult.error.format());
      }
      const { id } = parseResult.data;

      await this.userService.deleteUser(id, authReq.tenant.orgId);
      audit('user.deleted', authReq.user?.userId ?? 'unknown', { targetUserId: id });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
