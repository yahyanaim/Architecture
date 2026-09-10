import { IMembershipRepository, UserWorkspace } from '../../domain/interfaces/IMembershipRepository';
import { Membership, MembershipRole } from '../../domain/entities/Membership';
import { Organization } from '../../domain/entities/Organization';
import { db } from '../database';

interface MembershipRow {
  id: string;
  user_id: string;
  org_id: string;
  role: string;
  created_at: string;
}

interface WorkspaceJoinRow extends MembershipRow {
  o_id: string;
  o_name: string;
  o_slug: string;
  o_plan: string;
  o_status: string;
  o_created_at: string;
}

function toMembership(r: MembershipRow): Membership {
  return new Membership(
    r.id,
    r.user_id,
    r.org_id,
    r.role as MembershipRole,
    new Date(r.created_at)
  );
}

export class SqliteMembershipRepository implements IMembershipRepository {
  async findByUserAndOrg(userId: string, orgId: string): Promise<Membership | null> {
    const row = db
      .prepare('SELECT * FROM memberships WHERE user_id = ? AND org_id = ?')
      .get(userId, orgId) as MembershipRow | undefined;
    return row ? toMembership(row) : null;
  }

  async findAllByUser(userId: string): Promise<UserWorkspace[]> {
    const rows = db
      .prepare(
        `SELECT m.*, o.id AS o_id, o.name AS o_name, o.slug AS o_slug, o.plan AS o_plan, o.status AS o_status, o.created_at AS o_created_at
         FROM memberships m
         JOIN organizations o ON m.org_id = o.id
         WHERE m.user_id = ?
         ORDER BY m.created_at ASC`
      )
      .all(userId) as WorkspaceJoinRow[];

    return rows.map((r) => ({
      membership: toMembership(r),
      organization: new Organization(
        r.o_id,
        r.o_name,
        r.o_slug,
        r.o_plan as any,
        r.o_status as any,
        new Date(r.o_created_at)
      ),
    }));
  }

  async findAllByOrg(orgId: string): Promise<Membership[]> {
    const rows = db
      .prepare('SELECT * FROM memberships WHERE org_id = ? ORDER BY created_at ASC')
      .all(orgId) as MembershipRow[];
    return rows.map(toMembership);
  }

  async save(membership: Membership): Promise<void> {
    db.prepare(
      `INSERT INTO memberships (id, user_id, org_id, role, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, org_id) DO UPDATE SET role = excluded.role`
    ).run(
      membership.id,
      membership.userId,
      membership.orgId,
      membership.role,
      membership.createdAt.toISOString()
    );
  }

  async delete(userId: string, orgId: string): Promise<void> {
    db.prepare('DELETE FROM memberships WHERE user_id = ? AND org_id = ?').run(userId, orgId);
  }

  async countAdminsByOrg(orgId: string): Promise<number> {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM memberships WHERE org_id = ? AND role = 'admin'")
      .get(orgId) as { n: number };
    return row.n;
  }
}
