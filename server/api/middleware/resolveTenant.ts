import { Request, Response, NextFunction } from 'express';
import { ActiveUserRequest } from './requireActiveUser';

/**
 * Binds the request to the caller's tenant (workspace).
 *
 * TENANCY RULE: the org comes from the DB-hydrated account
 * (`requireActiveUser` attaches it), NOT from the JWT claim alone — a token
 * minted before an org move would otherwise leak the old tenant. If the JWT
 * claim disagrees with the DB, the token is stale -> 401 and the client
 * refreshes. Must run AFTER `requireActiveUser`.
 */
export function resolveTenant(req: Request, res: Response, next: NextFunction): void {
  const r = req as ActiveUserRequest;
  if (!r.account) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  if (r.user && r.user.orgId !== r.account.orgId) {
    res.status(401).json({ message: 'Session tenant changed — please refresh' });
    return;
  }
  r.tenant = { orgId: r.account.orgId };
  next();
}
