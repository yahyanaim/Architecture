import { Request, Response, NextFunction } from 'express';
import { ISubscriptionRepository } from '../../domain/interfaces/ITenant';
import { Plan } from '../../domain/entities/Subscription';
import { ActiveUserRequest } from './requireActiveUser';

/**
 * Plan gate (billing seam). Reads the org's subscription row — the ONLY
 * billing read in the request path — and allows inactive-safe plans only.
 * Must run AFTER `resolveTenant` (needs `req.tenant`).
 *
 * CONVENTIONS:
 * - 403 + machine-readable `code: 'upgrade_required'` (not 402: widely
 *   unsupported by clients/proxies; 403 with a code drives upgrade UX).
 * - No role bypass: instance admins pay too. If you need free internal
 *   workspaces, model them as a plan (`'internal'`), not as an if-statement.
 * - Not wired by default: attach per-route when a paid feature ships, e.g.
 *   `router.post('/reports', authenticate, requireActiveUser, resolveTenant,
 *   requirePlan('pro','enterprise'), handler)`.
 */
export function createRequirePlan(subscriptionRepository: ISubscriptionRepository) {
  return function requirePlan(...allowed: Plan[]) {
    return async function planGate(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const r = req as ActiveUserRequest;
        if (!r.tenant) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }
        const sub = await subscriptionRepository.findByOrgId(r.tenant.orgId);
        if (!sub || !sub.isActive() || !allowed.includes(sub.plan)) {
          res.status(403).json({
            message: 'This feature requires a paid plan',
            code: 'upgrade_required',
            plan: sub?.plan ?? 'none',
          });
          return;
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  };
}
