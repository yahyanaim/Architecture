import { Membership } from '../entities/Membership';
import { Organization } from '../entities/Organization';

export interface UserWorkspace {
  membership: Membership;
  organization: Organization;
}

export interface IMembershipRepository {
  findByUserAndOrg(userId: string, orgId: string): Promise<Membership | null>;
  findAllByUser(userId: string): Promise<UserWorkspace[]>;
  findAllByOrg(orgId: string): Promise<Membership[]>;
  save(membership: Membership): Promise<void>;
  delete(userId: string, orgId: string): Promise<void>;
  countAdminsByOrg(orgId: string): Promise<number>;
}
