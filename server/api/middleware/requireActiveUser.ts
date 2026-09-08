import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { User } from '../../domain/entities/User';

// Re-declare with the hydrated account attached so downstream middleware
// (`resolveTenant`) and controllers reuse it without a second DB hit.
export interface ActiveUserRequest extends AuthRequest {
  account?: User;
  tenant?: { orgId: string };
}

/**
 * Require a live, active user for the request.
 *
 * ARCHITECTURE / SECURITY NOTE:
 * - `authenticate` only verifies the JWT signature (stateless). It cannot see
 *   that the account was deactivated (`isActive=false`) or deleted afterwards,
 *   so a stolen/old token would stay valid until expiry (30d).
 * - This middleware closes that gap: it re-hydrates the user through the
 *   `IUserRepository` port (hexagonal adapter boundary) on every protected
 *   request and rejects unknown or deactivated accounts.
 * - DATA LIFECYCLE: login blocks inactive accounts at issuance time
 *   (`AuthService.login`); this enforces the same invariant for the whole
 *   lifetime of the token.
 *
 * Placed in the API layer (middleware) and built as a factory so the concrete
 * repository is injected at the composition root (routes) — never imported
 * directly here. That keeps the dependency direction API -> domain port, with
 * infrastructure supplied from the outside, and makes the middleware trivially
 * unit-testable with `InMemoryUserRepository`.
 */
export function createRequireActiveUser(userRepository: IUserRepository) {
  return async function requireActiveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as ActiveUserRequest;
      if (!authReq.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const user = await userRepository.findById(authReq.user.userId);
      if (!user) {
        // Account was deleted after the token was issued.
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      if (!user.isActive) {
        // Account was deactivated by an admin after the token was issued.
        res.status(403).json({ message: 'Forbidden: Account is disabled' });
        return;
      }

      // Attach the hydrated account: downstream (`resolveTenant`,
      // controllers) must use THIS, never re-trust JWT claims for identity.
      authReq.account = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
