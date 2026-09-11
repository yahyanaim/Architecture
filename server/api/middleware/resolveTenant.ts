import { Request, Response, NextFunction } from 'express';
import { ActiveUserRequest } from './requireActiveUser';
import { membershipRepository } from '../../infrastructure/repositories/SharedUserRepository';

/**
 * Binds the request to the caller's tenant (workspace).
 *
 * TENANCY RULE: the org comes from the DB-hydrated account
 * (`requireActiveUser` attaches it), NOT from the JWT claim alone — a token
 * minted before an org move would otherwise leak the old tenant.
 *
 * MULTI-ORG SUPPORT: if caller supplies an `X-Organization-Id` header (or
 * active_org_id cookie), verifies the caller has an active Membership in that
 * workspace, overriding the default tenant for the request.
 */
export interface TenantRequest extends ActiveUserRequest {
  tenant: { orgId: string };
}

export async function resolveTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  const r = req as ActiveUserRequest;
  if (!r.account) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const requestedOrgId = (req.headers['x-organization-id'] as string | undefined) || req.cookies?.active_org_id;

  if (requestedOrgId && requestedOrgId !== r.account.orgId) {
    try {
      const membership = await membershipRepository.findByUserAndOrg(r.account.id, requestedOrgId);
      if (!membership) {
        res.status(403).json({ message: 'You are not a member of this workspace' });
        return;
      }
      r.tenant = { orgId: requestedOrgId };
      r.account.role = membership.role;
      next();
      return;
    } catch (err) {
      next(err);
      return;
    }
  }

  if (r.user && r.user.orgId !== r.account.orgId && !requestedOrgId) {
    res.status(401).json({ message: 'Session tenant changed — please refresh' });
    return;
  }
  r.tenant = { orgId: r.account.orgId };
  next();
}
