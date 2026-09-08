import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

/**
 * Role gate (what may they do?). Must run AFTER `authenticate` (identity)
 * and `requireActiveUser` (liveness): it trusts `req.user.role`, so placing
 * it earlier would authorize stale/deleted accounts. Responds 403 directly —
 * a forbidden known identity is not an exception, it is the expected answer.
 */
export const authorizeAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as unknown as AuthRequest;
  
  // Check if user is authenticated and has admin role
  if (!authReq.user || authReq.user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
    return;
  }
  
  next();
};