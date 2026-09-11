import { IUserRepository } from '../interfaces/IUserRepository';
import { ITokenStore } from '../interfaces/ITenant';
import { IMembershipRepository } from '../interfaces/IMembershipRepository';
import { Membership } from '../entities/Membership';
import { User } from '../entities/User';
import { BusinessException } from '../exceptions/BusinessException';
import { NotFoundException } from '../exceptions/NotFoundException';
import crypto from 'crypto';

/**
 * Workspace user management (admin flows within ONE org).
 * TENANCY: every method is org-scoped — listings use `findAllByOrg`, and
 * creation pins the new account to the caller's org.
 *
 * MULTI-ORG SUPPORT:
 * When IMembershipRepository is provided, memberships table is the source of truth
 * for workspace membership. Inviting an existing user creates a Membership in the
 * target org instead of failing, and removing a user from a workspace leaves their
 * account intact if they belong to other workspaces.
 */
export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenStore: ITokenStore,
    private readonly membershipRepository?: IMembershipRepository
  ) {}

  async createUser(
    name: string,
    email: string,
    orgId: string
  ): Promise<{ user: User; inviteToken: string; isExistingUser: boolean }> {
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      if (this.membershipRepository) {
        const existingMem = await this.membershipRepository.findByUserAndOrg(existingUser.id, orgId);
        if (existingMem) {
          throw new BusinessException('User is already a member of this workspace');
        }

        // Add user to this workspace with 'user' role
        const membership = Membership.create(existingUser.id, orgId, 'user');
        await this.membershipRepository.save(membership);
        return { user: existingUser, inviteToken: '', isExistingUser: true };
      }

      throw new BusinessException('User with this email already exists');
    }

    // Provision new user
    const user = await User.create(name, email, `unusable-${Date.now()}-${Math.random()}`, 'user');
    user.orgId = orgId;
    await this.userRepository.save(user);

    if (this.membershipRepository) {
      await this.membershipRepository.save(Membership.create(user.id, orgId, 'user'));
    }

    const inviteToken = crypto.randomBytes(32).toString('base64url');
    await this.tokenStore.createAuthToken({
      userId: user.id,
      type: 'invite',
      tokenHash: crypto.createHash('sha256').update(inviteToken).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      meta: { orgId, email },
    });

    return { user, inviteToken, isExistingUser: false };
  }

  // ID-ORACLE GUARD (tenancy): mutations by :id MUST prove the target lives
  // in the caller's org. Missing OR foreign both answer 404.
  async toggleUserStatus(id: string, orgId: string, actorId?: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (this.membershipRepository) {
      const mem = await this.membershipRepository.findByUserAndOrg(id, orgId);
      if (!mem) throw new NotFoundException('User not found');

      if (actorId && actorId === id) {
        throw new BusinessException('Cannot deactivate your own account');
      }

      if (mem.role === 'admin' && user.isActive) {
        const adminCount = await this.membershipRepository.countAdminsByOrg(orgId);
        if (adminCount <= 1) {
          throw new BusinessException('Cannot deactivate the sole admin of the workspace');
        }
      }
    } else {
      if (user.orgId !== orgId) throw new NotFoundException('User not found');
      if (actorId && actorId === id) throw new BusinessException('Cannot deactivate your own account');
      if (user.role === 'admin' && user.isActive) {
        const orgUsers = await this.userRepository.findAllByOrg(orgId);
        const activeAdmins = orgUsers.filter((u) => u.role === 'admin' && u.isActive && u.id !== id);
        if (activeAdmins.length === 0) {
          throw new BusinessException('Cannot deactivate the sole admin of the workspace');
        }
      }
    }

    user.toggleActiveStatus();
    await this.userRepository.save(user);
    return user;
  }

  async deleteUser(id: string, orgId: string, actorId?: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (this.membershipRepository) {
      const mem = await this.membershipRepository.findByUserAndOrg(id, orgId);
      if (!mem) throw new NotFoundException('User not found');

      if (actorId && actorId === id) {
        throw new BusinessException('Cannot delete your own account via user management');
      }

      if (mem.role === 'admin') {
        const adminCount = await this.membershipRepository.countAdminsByOrg(orgId);
        if (adminCount <= 1) {
          throw new BusinessException('Cannot delete the sole admin of the workspace');
        }
      }

      await this.membershipRepository.delete(id, orgId);

      // If user has no other memberships in any workspace, remove the user row
      const remaining = await this.membershipRepository.findAllByUser(id);
      if (remaining.length === 0) {
        await this.userRepository.delete(id);
      }
    } else {
      if (user.orgId !== orgId) throw new NotFoundException('User not found');
      if (actorId && actorId === id) {
        throw new BusinessException('Cannot delete your own account via user management');
      }
      if (user.role === 'admin') {
        const orgUsers = await this.userRepository.findAllByOrg(orgId);
        const otherAdmins = orgUsers.filter((u) => u.role === 'admin' && u.isActive && u.id !== id);
        if (otherAdmins.length === 0) {
          throw new BusinessException('Cannot delete the sole admin of the workspace');
        }
      }
      await this.userRepository.delete(id);
    }
  }

  /** Tenant-scoped listing — admins see users in their OWN org through memberships. */
  async getAllUsers(orgId: string): Promise<User[]> {
    if (this.membershipRepository) {
      const memberships = await this.membershipRepository.findAllByOrg(orgId);
      const users: User[] = [];
      for (const m of memberships) {
        const u = await this.userRepository.findById(m.userId);
        if (u) {
          u.role = m.role === 'admin' ? 'admin' : 'user';
          users.push(u);
        }
      }
      return users;
    }

    return this.userRepository.findAllByOrg(orgId);
  }
}
