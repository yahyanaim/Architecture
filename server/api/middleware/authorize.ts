import { Request, Response, NextFunction } from 'express';
import { ActiveUserRequest } from './requireActiveUser';

/**
 * Role gate (what may they do?). Must run AFTER `authenticate` (identity)
 * and `requireActiveUser` (liveness): evaluates the fresh DB-hydrated role
 * (`req.account.role`), falling back to the JWT claim (`req.user.role`).
 * This closes the window where a demoted admin retains admin access.
 */
export const authorizeAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as ActiveUserRequest;
  
  const role = authReq.account?.role ?? authReq.user?.role;
  if (!role || role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
    return;
  }
  
  next();
};