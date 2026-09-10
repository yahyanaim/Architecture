import { Request, Response, NextFunction } from 'express';
import { ActiveUserRequest } from '../middleware/requireActiveUser';
import { IMembershipRepository } from '../../domain/interfaces/IMembershipRepository';
import { IOrganizationRepository, ISubscriptionRepository } from '../../domain/interfaces/ITenant';
import { Organization } from '../../domain/entities/Organization';
import { Subscription } from '../../domain/entities/Subscription';
import { Membership } from '../../domain/entities/Membership';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { defaultTokenService } from '../../infrastructure/security/JwtTokenService';
import { audit } from '../../infrastructure/audit';

export class WorkspaceController {
  constructor(
    private readonly membershipRepository: IMembershipRepository,
    private readonly orgRepository: IOrganizationRepository,
    private readonly subscriptionRepository: ISubscriptionRepository
  ) {}

  listWorkspaces = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as ActiveUserRequest;
      if (!r.account) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const workspaces = await this.membershipRepository.findAllByUser(r.account.id);
      res.json(
        workspaces.map((w) => ({
          id: w.organization.id,
          name: w.organization.name,
          slug: w.organization.slug,
          plan: w.organization.plan,
          status: w.organization.status,
          role: w.membership.role,
          joinedAt: w.membership.createdAt.toISOString(),
          isCurrent: w.organization.id === r.tenant?.orgId,
        }))
      );
    } catch (err) {
      next(err);
    }
  };

  createWorkspace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const r = req as ActiveUserRequest;
      if (!r.account) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { name } = req.body || {};
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        throw new ValidationException('Validation failed', {
          name: 'Workspace name must be at least 2 characters',
        });
      }

      const cleanName = name.trim();
      const slug = defaultTokenService.slugify(cleanName);
      const orgId = globalThis.crypto.randomUUID();

      const org = new Organization(orgId, cleanName, slug, 'free', 'active', new Date());
      await this.orgRepository.save(org);
      await this.subscriptionRepository.save(new Subscription(org.id, 'free', 'trialing'));

      const membership = Membership.create(r.account.id, org.id, 'admin');
      await this.membershipRepository.save(membership);

      audit('workspace.created', r.account.id, {
        targetId: org.id,
        name: cleanName,
        slug,
      });

      res.status(201).json({
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        status: org.status,
        role: membership.role,
        joinedAt: membership.createdAt.toISOString(),
        isCurrent: true,
      });
    } catch (err) {
      next(err);
    }
  };
}
