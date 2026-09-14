import { PostgresExecutor, pgExecutor } from '../pg';
import { IMembershipRepository, UserWorkspace } from '../../domain/interfaces/IMembershipRepository';
import { Membership, MembershipRole } from '../../domain/entities/Membership';
import { Organization } from '../../domain/entities/Organization';

interface MembershipRow {
  id: string;
  user_id: string;
  org_id: string;
  role: string;
  created_at: string | Date;
}

interface WorkspaceJoinRow extends MembershipRow {
  o_id: string;
  o_name: string;
  o_slug: string;
  o_plan: string;
  o_status: string;
  o_created_at: string | Date;
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

export class PgMembershipRepository implements IMembershipRepository {
  private db: PostgresExecutor;

  constructor(db?: PostgresExecutor) {
    this.db = db ?? pgExecutor;
  }

  async findByUserAndOrg(userId: string, orgId: string): Promise<Membership | null> {
    const res = await this.db.query<MembershipRow>(
      'SELECT * FROM memberships WHERE user_id = $1 AND org_id = $2',
      [userId, orgId]
    );
    return res.rows[0] ? toMembership(res.rows[0]) : null;
  }

  async findAllByUser(userId: string): Promise<UserWorkspace[]> {
    const res = await this.db.query<WorkspaceJoinRow>(
      `SELECT m.*, o.id AS o_id, o.name AS o_name, o.slug AS o_slug, o.plan AS o_plan, o.status AS o_status, o.created_at AS o_created_at
       FROM memberships m
       JOIN organizations o ON m.org_id = o.id
       WHERE m.user_id = $1
       ORDER BY m.created_at ASC`,
      [userId]
    );

    return res.rows.map((r) => ({
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
    const res = await this.db.query<MembershipRow>(
      'SELECT * FROM memberships WHERE org_id = $1 ORDER BY created_at ASC',
      [orgId]
    );
    return res.rows.map(toMembership);
  }

  async save(membership: Membership): Promise<void> {
    await this.db.query(
      `INSERT INTO memberships (id, user_id, org_id, role, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(user_id, org_id) DO UPDATE SET role = EXCLUDED.role`,
      [
        membership.id,
        membership.userId,
        membership.orgId,
        membership.role,
        membership.createdAt.toISOString()
      ]
    );
  }

  async delete(userId: string, orgId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM memberships WHERE user_id = $1 AND org_id = $2',
      [userId, orgId]
    );
  }

  async countAdminsByOrg(orgId: string): Promise<number> {
    const res = await this.db.query<{ n: string | number }>(
      "SELECT COUNT(*) AS n FROM memberships WHERE org_id = $1 AND role = 'admin'",
      [orgId]
    );
    return Number(res.rows[0]?.n ?? 0);
  }
}

export { PgMembershipRepository as PostgresMembershipRepository };
