import { Request, Response, NextFunction } from 'express';
import { ISubscriptionRepository } from '../../domain/interfaces/ITenant';
import { IMembershipRepository } from '../../domain/interfaces/IMembershipRepository';
import { Plan } from '../../domain/entities/Subscription';
import { ActiveUserRequest } from './requireActiveUser';

export type RequirePlanArg = Plan | { plans?: Plan[]; enforceSeats?: boolean };

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
 * - Supports seat limit enforcement when `enforceSeats: true` is configured.
 */
export function createRequirePlan(
  subscriptionRepository: ISubscriptionRepository,
  membershipRepository?: IMembershipRepository
) {
  return function requirePlan(...args: RequirePlanArg[]) {
    let allowed: Plan[] = [];
    let enforceSeats = false;

    for (const arg of args) {
      if (typeof arg === 'string') {
        allowed.push(arg);
      } else if (typeof arg === 'object' && arg !== null) {
        if (arg.plans) allowed.push(...arg.plans);
        if (arg.enforceSeats) enforceSeats = true;
      }
    }

    return async function planGate(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const r = req as ActiveUserRequest;
        if (!r.tenant) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }
        const sub = await subscriptionRepository.findByOrgId(r.tenant.orgId);
        // hasAccess() (not isActive()): past_due inside its dunning grace
        // keeps working — cutting access mid-grace would contradict the
        // graceUntil we show the user on GET /billing/subscription.
        if (!sub || !sub.hasAccess() || (allowed.length > 0 && !allowed.includes(sub.plan))) {
          res.status(403).json({
            message: 'This feature requires an active plan',
            code: 'upgrade_required',
            plan: sub?.plan ?? 'none',
          });
          return;
        }

        if (enforceSeats && membershipRepository) {
          const currentMembers = await membershipRepository.countByOrg(r.tenant.orgId);
          const maxSeats = sub.seats ?? 5;
          if (currentMembers >= maxSeats) {
            res.status(403).json({
              message: `Seat limit reached (${currentMembers}/${maxSeats} seats used). Please upgrade your plan or add seats.`,
              code: 'upgrade_required',
              reason: 'seat_limit_exceeded',
              seats: maxSeats,
              currentSeats: currentMembers,
              plan: sub.plan,
            });
            return;
          }
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };
}
