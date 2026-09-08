import { Request, Response, NextFunction } from 'express';
import { ActiveUserRequest } from './requireActiveUser';

/**
 * Opt-in email-verification gate. Exported for routes that must require a
 * verified address (e.g. sending invites, billing changes) — attach AFTER
 * `requireActiveUser`. NOT wired globally on purpose: login stays open for
 * unverified accounts so verification rollout (and legacy/imported accounts)
 * can never hard-lock users out. Flip to enforced per-route when ready.
 */
export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  const r = req as ActiveUserRequest;
  if (!r.account) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  if (!r.account.isVerified) {
    res.status(403).json({ message: 'Email verification required', code: 'email_unverified' });
    return;
  }
  next();
}
