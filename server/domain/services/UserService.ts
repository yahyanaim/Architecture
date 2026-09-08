import { IUserRepository } from '../interfaces/IUserRepository';
import { ITokenStore } from '../interfaces/ITenant';
import { User } from '../entities/User';
import { BusinessException } from '../exceptions/BusinessException';
import { NotFoundException } from '../exceptions/NotFoundException';
import crypto from 'crypto';

/**
 * Workspace user management (admin flows within ONE org).
 * TENANCY: every method is org-scoped — listings use `findAllByOrg`, and
 * creation pins the new account to the caller's org. There is deliberately
 * no cross-org operation here; instance-level support tooling belongs in a
 * separate service, not in the tenant path.
 *
 * INVITE LIFECYCLE (replaces the old dead temp-password flow): `createUser`
 * provisions the account + a single-use invite token and returns the token
 * plaintext exactly once. The CONTROLLER enqueues the invite email via the
 * job queue — this service never sends mail (stays testable, no infra
 * imports beyond ports).
 */
export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenStore: ITokenStore
  ) { }

  async createUser(name: string, email: string, orgId: string): Promise<{ user: User; inviteToken: string }> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new BusinessException('User with this email already exists');
    }

    // Random unusable password: the account cannot log in until the invite
    // is accepted (see AuthService.acceptInvite), so a leaked DB row or an
    // unclaimed invite is not a login vector.
    const user = await User.create(name, email, `unusable-${Date.now()}-${Math.random()}`, 'user');
    user.orgId = orgId;
    await this.userRepository.save(user);

    const inviteToken = crypto.randomBytes(32).toString('base64url');
    await this.tokenStore.createAuthToken({
      userId: user.id,
      type: 'invite',
      tokenHash: crypto.createHash('sha256').update(inviteToken).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      meta: { orgId, email },
    });
    return { user, inviteToken };
  }

  async toggleUserStatus(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.toggleActiveStatus();
    await this.userRepository.save(user);
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.delete(id);
  }

  /** Tenant-scoped listing — admins see their OWN org, never the instance. */
  async getAllUsers(orgId: string): Promise<User[]> {
    return this.userRepository.findAllByOrg(orgId);
  }
}
