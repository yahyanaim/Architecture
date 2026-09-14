import { IUserRepository } from '../interfaces/IUserRepository';
import { ITokenStore } from '../interfaces/ITenant';
import { User } from '../entities/User';
import { NotFoundException } from '../exceptions/NotFoundException';
import { BusinessException } from '../exceptions/BusinessException';
import { db } from '../../infrastructure/database';
import { redactPII } from '../../infrastructure/observability';
import { JobQueue } from '../../infrastructure/queue';

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export interface GdprExportData {
  user: Record<string, unknown>;
  org: Record<string, unknown> | null;
  subs: Record<string, unknown> | null;
  keys: Record<string, unknown>[];
  audit: Record<string, unknown>[];
}

export class ProfileService {
  // `tokenStore` and `jobQueue` are optional for backward compatibility
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenStore?: ITokenStore,
    private readonly jobQueue?: JobQueue
  ) { }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, updates: UpdateProfileInput): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updates.email && updates.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(updates.email);
      if (existingUser && existingUser.id !== userId) {
        throw new BusinessException('Email already in use');
      }
      user.email = updates.email;
      user.emailVerifiedAt = null; // Email changed -> requires re-verification
    }

    if (updates.name) {
      user.name = updates.name;
    }

    await this.userRepository.save(user);
    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin') {
      const orgUsers = await this.userRepository.findAllByOrg(user.orgId);
      const otherMembers = orgUsers.filter((u) => u.id !== userId);
      const otherAdmins = otherMembers.filter((u) => u.role === 'admin' && u.isActive);
      if (otherMembers.length > 0 && otherAdmins.length === 0) {
        throw new BusinessException('Cannot delete account: you are the sole admin of this workspace. Promote another member first.');
      }
    }

    await this.userRepository.delete(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new BusinessException('Current password is incorrect');
    }

    user.password = await User.hashPassword(newPassword);
    await this.userRepository.save(user);
    // Credential change = session kill: every OTHER device/session dies with
    // the old password (the caller's session is refreshed by the controller
    // issuing a new pair — see ProfileController.changePassword).
    if (this.tokenStore) {
      await this.tokenStore.revokeAllForUser(userId);
    }
  }

  async exportUserData(userId: string): Promise<GdprExportData> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let org: any = null;
    let subs: any = null;
    let keys: any[] = [];
    let auditLogs: any[] = [];

    try {
      org = db.prepare('SELECT id, name, slug, plan, status, created_at FROM organizations WHERE id = ?').get(user.orgId);
    } catch {}

    try {
      subs = db.prepare('SELECT plan, status, provider, current_period_end, seats, created_at, updated_at FROM subscriptions WHERE org_id = ?').get(user.orgId);
    } catch {}

    try {
      const rawKeys = db.prepare('SELECT id, name, key_prefix, scopes, created_at, last_used_at, expires_at FROM api_keys WHERE user_id = ?').all(userId) as any[];
      keys = (rawKeys || []).map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.key_prefix,
        scopes: typeof k.scopes === 'string' ? JSON.parse(k.scopes) : k.scopes,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        expiresAt: k.expires_at,
      }));
    } catch {}

    try {
      const rawAudit = db.prepare('SELECT id, timestamp, event, actor_id, org_id, details FROM audit_logs WHERE actor_id = ? ORDER BY timestamp DESC').all(userId) as any[];
      auditLogs = (rawAudit || []).map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        event: a.event,
        actorId: a.actor_id,
        orgId: a.org_id,
        details: typeof a.details === 'string' ? JSON.parse(a.details) : a.details,
      }));
    } catch {}

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      },
      org: org ? {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        status: org.status,
        createdAt: org.created_at,
      } : null,
      subs: subs ? {
        plan: subs.plan,
        status: subs.status,
        provider: subs.provider,
        currentPeriodEnd: subs.current_period_end,
        seats: subs.seats,
        createdAt: subs.created_at,
        updatedAt: subs.updated_at,
      } : null,
      keys,
      audit: auditLogs,
    };
  }

  async purgeAccount(userId: string): Promise<{ purgeDueAt: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin') {
      const orgUsers = await this.userRepository.findAllByOrg(user.orgId);
      const otherMembers = orgUsers.filter((u) => u.id !== userId);
      const otherAdmins = otherMembers.filter((u) => u.role === 'admin' && u.isActive);
      if (otherMembers.length > 0 && otherAdmins.length === 0) {
        throw new BusinessException('Cannot purge account: you are the sole admin of this workspace. Promote another member first.');
      }
    }

    const now = new Date();
    const purgeDueAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 1. Soft-delete user
    try {
      db.prepare('UPDATE users SET is_active = 0, deleted_at = ?, purge_due_at = ? WHERE id = ?')
        .run(now.toISOString(), purgeDueAt.toISOString(), userId);
    } catch {
      user.isActive = false;
      await this.userRepository.save(user);
    }

    // 2. Kill all active sessions & tokens
    try {
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(userId);
    } catch {}

    if (this.tokenStore) {
      await this.tokenStore.revokeAllForUser(userId);
    }

    // 3. Anonymize audit logs (scrub actor_id and PII in details)
    try {
      const logs = db.prepare('SELECT id, details FROM audit_logs WHERE actor_id = ?').all(userId) as { id: string; details: string }[];
      const updateStmt = db.prepare("UPDATE audit_logs SET actor_id = 'anonymized', details = ? WHERE id = ?");
      for (const log of logs) {
        let clean = log.details;
        try {
          clean = JSON.stringify(redactPII(JSON.parse(log.details)));
        } catch {
          clean = clean.replace(user.email, '***');
        }
        updateStmt.run(clean, log.id);
      }
    } catch {}

    // 4. Enqueue hard purge background job
    if (this.jobQueue) {
      await this.jobQueue.enqueue('user.purge', { userId }, { runAt: purgeDueAt });
    }

    return { purgeDueAt: purgeDueAt.toISOString() };
  }
}