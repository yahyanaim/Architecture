import { DATABASE_URL } from '../../config/index';
import { SqliteUserRepository } from './SqliteUserRepository';
import { SqliteTokenStore } from './SqliteTokenStore';
import { SqliteBillingRepository } from './SqliteBillingRepository';
import { SqliteMembershipRepository } from './SqliteMembershipRepository';
import { SqliteOutboxRepository } from './SqliteOutboxRepository';
import { SqliteTwoFactorRepository } from './SqliteTwoFactorRepository';
import { SqliteApiKeyRepository } from './SqliteApiKeyRepository';
import { SqliteAuditLogRepository } from './SqliteAuditLogRepository';
import { OutboxRelay } from '../outbox/OutboxRelay';
import { defaultTotpService } from '../security/TotpService';
import { LogMailer } from '../mailer';
import { JobQueue } from '../queue';
import { defaultPasswordHasher } from '../security/BcryptPasswordHasher';
import { defaultTokenService } from '../security/JwtTokenService';
import { User } from '../../domain/entities/User';
import { AuthService } from '../../domain/services/AuthService';

import { PgUserRepository } from './PgUserRepository';
import { PgBillingRepository } from './PgBillingRepository';
import { PgMembershipRepository } from './PgMembershipRepository';
import { PgTokenStore } from './PgTokenStore';
import { PgOutboxRepository } from './PgOutboxRepository';
import { PgApiKeyRepository } from './PgApiKeyRepository';
import { PgAuditLogRepository } from './PgAuditLogRepository';
import { PgTwoFactorRepository } from './PgTwoFactorRepository';

// Initialize default domain ports in composition root
User.setDefaultHasher(defaultPasswordHasher);
AuthService.setDefaultTokenService(defaultTokenService);

export const passwordHasher = defaultPasswordHasher;
export const tokenService = defaultTokenService;

/**
 * Infrastructure composition root (singletons).
 *
 * ARCHITECTURE: routes import ADAPTERS from here — never `database.ts`,
 * drivers, or providers directly. Swapping stores (SQLite -> Postgres) means
 * implementing the same domain ports and changing these lines only; domain
 * and API layers stay untouched. `migrate()` runs separately at boot
 * (`server.ts`) so schema always precedes first use.
 *
 * NOTE on runtime switching: If `DATABASE_URL` is set in configuration,
 * all repositories automatically switch to PostgreSQL adapters (`Pg*`).
 * When `DATABASE_URL` is unset, the system uses SQLite adapters (`Sqlite*`).
 *
 * NOTE on tests: `database.ts` opens `:memory:` under NODE_ENV=test, and
 * constructing these adapters performs no I/O, so importing this module in
 * tests is side-effect free.
 */
export const isPostgresActive = Boolean(DATABASE_URL);

export const userRepository = isPostgresActive
  ? new PgUserRepository()
  : new SqliteUserRepository();

export const tokenStore = isPostgresActive
  ? new PgTokenStore()
  : new SqliteTokenStore();

export const billingRepository = isPostgresActive
  ? new PgBillingRepository()
  : new SqliteBillingRepository();

// Org + subscription share one class (both are tiny org-scoped lookups).
export const orgRepository = billingRepository;
export const subscriptionRepository = billingRepository;

export const membershipRepository = isPostgresActive
  ? new PgMembershipRepository()
  : new SqliteMembershipRepository();

export const outboxRepository = isPostgresActive
  ? new PgOutboxRepository()
  : new SqliteOutboxRepository();

export const outboxRelay = new OutboxRelay(outboxRepository);

export const twoFactorRepository = isPostgresActive
  ? new PgTwoFactorRepository()
  : new SqliteTwoFactorRepository();

export const totpService = defaultTotpService;

export const apiKeyRepository = isPostgresActive
  ? new PgApiKeyRepository()
  : new SqliteApiKeyRepository();

export const auditLogRepository = isPostgresActive
  ? new PgAuditLogRepository()
  : new SqliteAuditLogRepository();

// Mailer: LogMailer writes to `data/outbox/` (dev/test friendly outbox
// pattern). For prod, implement `SmtpMailer`/provider client against the
// `Mailer` port and swap this line.
export const mailer = new LogMailer();

// Durable job queue (SQLite `jobs` table). Worker started in `server.ts`.
export const jobQueue = new JobQueue(mailer);
