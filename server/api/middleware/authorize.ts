import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

/**
 * Middleware to check if the authenticated user has admin role
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