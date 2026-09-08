import { Router, Request, Response, NextFunction } from 'express';
import { billingRepository, userRepository } from '../../infrastructure/repositories/SharedUserRepository';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser, ActiveUserRequest } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';

const router = Router();
const requireActiveUser = createRequireActiveUser(userRepository);

// BILLING SEAM: read-only surface for the current org's subscription.
// Writes belong to the provider webhook handler (not built yet) — when
// Stripe connects, add `POST /api/billing/webhook` (raw-body, signature
// verified) that calls `billingRepository.updatePlan()`. Controllers never
// call provider SDKs; enforcement lives in `requirePlan` middleware.
router.get('/subscription', authenticate, requireActiveUser, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = req as ActiveUserRequest;
    const sub = await billingRepository.findByOrgId(r.tenant!.orgId);
    if (!sub) {
      res.status(404).json({ message: 'No subscription found for this workspace' });
      return;
    }
    res.json({
      orgId: sub.orgId,
      plan: sub.plan,
      status: sub.status,
      provider: sub.provider,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    });
  } catch (error) {
    next(error);
  }
});

export { router as billingRoutes };
