import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './infrastructure/database';
import { migrate } from './infrastructure/db/migrate';

// ============================================================================
// ARCHITECTURE TRIPWIRE — tenancy guard. Human review misses a dropped
// `org_id` filter as the codebase grows; this test doesn't. It enforces two
// invariants mechanically (and fails CI on violation):
//   A. Every SQL statement against a tenant table (any table WITH an
//      `org_id` column — discovered from the live schema, not hardcoded)
//      must reference `org_id`, unless explicitly allowlisted with a reason.
//   B. Every route in tenant route files must carry `resolveTenant` in its
//      chain, in order (authenticate -> requireActiveUser -> resolveTenant).
//      New route files are denied by default until given a policy below.
// This is a tripwire, not a proof: allowlisting requires a written reason,
// and stale allowlist entries fail the run (no silent rot).
// ============================================================================

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOS_DIR = path.join(HERE, 'infrastructure', 'repositories');
const ROUTES_DIR = path.join(HERE, 'api', 'routes');

interface Allowance {
  file: string;
  /** distinctive substring of the normalized statement */
  match: string;
  reason: string;
}

// Reviewed exceptions. Each must still match a real statement every run.
const SQL_ALLOWLIST: Allowance[] = [
  {
    file: 'SqliteUserRepository.ts',
    match: 'select count(*) as n from users',
    reason: 'BOOTSTRAP: hasUsers() returns a scalar count for first-user-admin detection; no rows leak.',
  },
  {
    file: 'SqliteUserRepository.ts',
    match: 'select * from users where email = ?',
    reason: 'GLOBAL IDENTITY: login needs no tenant hint; returns one row for credential check only.',
  },
  {
    file: 'SqliteUserRepository.ts',
    match: 'select * from users where id = ?',
    reason: 'JWT-SUBJECT HYDRATION: requireActiveUser loads the caller by token subject; mutations re-check org at the service layer (UserService id-oracle guard, tested).',
  },
  {
    file: 'SqliteUserRepository.ts',
    match: 'delete from users where id = ?',
    reason: 'PK delete reached only after UserService.deleteUser(id, orgId) proves target-in-org (404 otherwise).',
  },
  {
    file: 'SqliteBillingRepository.ts',
    match: 'select * from subscriptions where provider_ref = ?',
    reason: 'WEBHOOK REVERSE LOOKUP: Stripe sends subscription id, not org. Called only post-HMAC from webhook handlers; keyed by unguessable provider id, single row, no listing.',
  },
  {
    file: 'SqliteApiKeyRepository.ts',
    match: 'select * from api_keys where key_hash = ?',
    reason: 'GLOBAL KEY LOOKUP: API key bearer auth finds credential by SHA-256 hash before tenant hydration.',
  },
];

function tenantTables(): Set<string> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  const out = new Set<string>();
  for (const { name } of tables) {
    const cols = db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[];
    if (cols.some((c) => c.name === 'org_id')) out.add(name);
  }
  return out;
}

function extractStatements(file: string): string[] {
  const src = fs.readFileSync(file, 'utf-8');
  const found: string[] = [];
  // db.prepare(`...`), db.prepare('...'), db.prepare("...")
  const re = /\.prepare\(\s*(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const raw = m[1]!;
    const sql = raw.slice(1, -1); // strip quotes
    for (const stmt of sql.split(';')) {
      const s = stmt.trim();
      if (s) found.push(s);
    }
  }
  return found;
}

function tablesIn(stmt: string): string[] {
  const out: string[] = [];
  const re = /\b(?:FROM|INTO|UPDATE|JOIN)\s+["'`\[]?(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stmt)) !== null) out.push(m[1]!.toLowerCase());
  return [...new Set(out)];
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

describe('tenancy guard', () => {
  beforeAll(() => {
    migrate(db); // schema must exist for PRAGMA discovery (:memory: in tests)
  });

  it('A: every tenant-table statement references org_id (or is allowlisted)', () => {
    const tenants = tenantTables();
    expect(tenants.size).toBeGreaterThan(0); // guard must never pass vacuously

    const files = fs.readdirSync(REPOS_DIR).filter((f) => f.startsWith('Sqlite') && f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);

    const used = new Set<number>();
    const violations: string[] = [];

    for (const file of files) {
      for (const stmt of extractStatements(path.join(REPOS_DIR, file))) {
        const targets = tablesIn(stmt).filter((t) => tenants.has(t));
        if (targets.length === 0) continue;
        if (/org_id/i.test(stmt)) continue;
        const n = norm(stmt);
        const idx = SQL_ALLOWLIST.findIndex((a) => a.file === file && n.includes(a.match));
        if (idx >= 0) {
          used.add(idx);
        } else {
          violations.push(`${file}: [${targets.join(',')}] ${n.slice(0, 120)}`);
        }
      }
    }

    expect(violations).toEqual([]);

    // No stale allowlist: every exception must still match a real statement.
    const stale = SQL_ALLOWLIST.filter((_, i) => !used.has(i)).map((a) => `${a.file}: ${a.match}`);
    expect(stale).toEqual([]);
  });

  it('B: tenant route files chain resolveTenant in order; new files denied by default', () => {
    // Closed-by-default registry: a new file in routes/ fails this test until
    // it gets an explicit policy here. `scoped: true` = every route line must
    // contain resolveTenant AFTER requireActiveUser.
    const POLICY: Record<string, { scoped: boolean; reason: string }> = {
      'userRoutes.ts': { scoped: true, reason: 'tenant admin console' },
      'profileRoutes.ts': { scoped: true, reason: 'self-service within caller tenant' },
      'billingRoutes.ts': { scoped: true, reason: 'reads caller subscription' },
      'workspaceRoutes.ts': { scoped: true, reason: 'multi-workspace management for authenticated users' },
      'apiKeyRoutes.ts': { scoped: true, reason: 'developer api key management scoped to caller workspace' },
      'auditLogRoutes.ts': { scoped: true, reason: 'admin audit log viewing scoped to caller workspace' },
      'authRoutes.ts': { scoped: false, reason: 'pre-auth public flows (register/login/refresh/verify/reset/invite); me is identity-only' },
    };

    const files = fs.readdirSync(ROUTES_DIR);
    const routeFiles = files.filter((f) => f.endsWith('Routes.ts'));
    expect(routeFiles.length).toBeGreaterThan(0);

    const unregistered = routeFiles.filter((f) => !(f in POLICY));
    expect(unregistered).toEqual([]);

    for (const [file, policy] of Object.entries(POLICY)) {
      const src = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf-8');
      const lines = src.split('\n').filter((l) => /router\.\w+\(/.test(l));
      expect(lines.length).toBeGreaterThan(0);
      if (!policy.scoped) continue;
      for (const line of lines) {
        expect(line).toContain('resolveTenant');
        // Chain order = security model: identity -> liveness -> tenant.
        const order = ['authenticate', 'requireActiveUser', 'resolveTenant'].map((m) => line.indexOf(m));
        expect(order.every((i) => i >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
      }
    }
  });
});
