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

/**
 * Infrastructure composition root (singletons).
 *
 * ARCHITECTURE: routes import ADAPTERS from here — never `database.ts`,
 * drivers, or providers directly. Swapping stores (SQLite -> Postgres) means
 * implementing the same domain ports and changing these lines only; domain
 * and API layers stay untouched. `migrate()` runs separately at boot
 * (`server.ts`) so schema always precedes first use.
 *
 * NOTE on tests: `database.ts` opens `:memory:` under NODE_ENV=test, and
 * constructing these adapters performs no I/O, so importing this module in
 * tests is side-effect free.
 */
export const userRepository = new SqliteUserRepository();
export const tokenStore = new SqliteTokenStore();
export const billingRepository = new SqliteBillingRepository();
// Org + subscription share one class (both are tiny org-scoped lookups).
export const orgRepository = billingRepository;
export const subscriptionRepository = billingRepository;
export const membershipRepository = new SqliteMembershipRepository();
export const outboxRepository = new SqliteOutboxRepository();
export const outboxRelay = new OutboxRelay(outboxRepository);
export const twoFactorRepository = new SqliteTwoFactorRepository();
export const totpService = defaultTotpService;
export const apiKeyRepository = new SqliteApiKeyRepository();
export const auditLogRepository = new SqliteAuditLogRepository();

// Mailer: LogMailer writes to `data/outbox/` (dev/test friendly outbox
// pattern). For prod, implement `SmtpMailer`/provider client against the
// `Mailer` port and swap this line.
export const mailer = new LogMailer();

// Durable job queue (SQLite `jobs` table). Worker started in `server.ts`.
export const jobQueue = new JobQueue(mailer);

