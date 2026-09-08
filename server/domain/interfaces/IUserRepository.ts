import { User } from '../entities/User';

// PORT (hexagonal): the only contract the domain depends on for persistence.
// Services take this interface via constructor injection; infrastructure
// supplies the adapter (`SqliteUserRepository` in prod/dev, in-memory/file
// doubles in tests). Rule: this file may import domain types only — never
// `fs`, `express`, or any driver — or the dependency direction inverts and
// Clean Architecture is broken.
//
// TENANCY RULE: identity lookups (`findByEmail`) are global; data-access
// listings are org-scoped (`findByEmailAndOrg`, `findAllByOrg`). Services
// must use the scoped variants whenever acting within a tenant context.
// NOTE: there is deliberately NO unscoped `findAll` on this port — a global
// user dump is a cross-tenant leak waiting to happen. Instance-level support
// tooling gets its own audited path if ever needed, not this port.
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailAndOrg(email: string, orgId: string): Promise<User | null>;
  findAllByOrg(orgId: string): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  hasUsers(): Promise<boolean>;
}
