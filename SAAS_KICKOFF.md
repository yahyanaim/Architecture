# SAAS_KICKOFF — AI Agent Guidelines

> Read this file first when starting a new SaaS project on this template.
> Lean by design: only the rules that keep the architecture intact. Everything
> else (demo UI, marketing copy) is deletable. Details live in `ARCHITECTURE.md`.

## 0. First actions

1. `cp .env.example .env` — set `JWT_SECRET` (64+ chars), `APP_URL`, `CORS_ORIGIN`.
2. `npm install && npm run dev` — boot runs migrations; first registered user = instance admin.
3. Decide what to strip: `src/components/MainApp.tsx` demo tabs, `UserList`/`CreateUserForm` demo, `PostgresUserRepository` stub OR `FileUserRepository` legacy — delete, don't work around.
4. Run `npm test && npm run lint` — must stay green after every change.

## 1. Inviolable rules

1. **Dependency direction:** `API -> Domain -> Ports <- Infrastructure`. Domain files import domain types only. No `express`/`fs`/drivers outside `server/infrastructure` + `server/config`.
2. **`process.env` lives in `server/config/index.ts` only.** Everything else receives values via injection or config import.
3. **Tenancy:** every tenant table has `org_id`; every query scopes by it; tenant comes from `req.tenant` (set by `resolveTenant`), NEVER from client input. Identity lookups (login) are global; listings are org-scoped.
4. **Route chain order is the security model:** `authenticate -> requireActiveUser -> resolveTenant -> authorizeAdmin / requirePlan -> controller`. Never reorder, never skip `requireActiveUser` on a protected route.
5. **Controllers validate (Zod `safeParse`), services decide, repositories persist.** No business rules in controllers; no HTTP in services; no secrets in logs/responses.
6. **Secrets:** store hashes only (bcrypt passwords, SHA-256 tokens). Plaintext tokens exist in transit (cookie/email) and are returned server-side for enqueueing — never persisted, never logged.
7. **Side effects off the request path:** emails/receipts/webhooks go through `jobQueue.enqueue()`; controllers return immediately.
8. **Errors:** throw `ValidationException` (Zod) / `BusinessException` (400) / `NotFoundException` (404) and `next(err)`; unexpected errors funnel to `errorHandler` (5xx + `reportError`). Auth failures answer 401/403 directly in middleware.

## 2. Adding a tenant-scoped feature (the recipe — e.g. `Invoice`)

1. **Migration** `server/infrastructure/db/migrations/002_invoices.sql` — table with `org_id TEXT NOT NULL REFERENCES organizations(id)`, portable SQL, never edit applied files.
2. **Entity** `server/domain/entities/Invoice.ts` — fields + invariants + methods (no I/O).
3. **Port** `server/domain/interfaces/IInvoiceRepository.ts` — `findByIdForOrg`, `findAllByOrg`, `save`, `delete` (org-scoped signatures from birth).
4. **Service** `server/domain/services/InvoiceService.ts` — constructor-inject port(s); all methods take `orgId`.
5. **Adapter** `server/infrastructure/repositories/SqliteInvoiceRepository.ts` — implement port; export singleton from `SharedUserRepository.ts`.
6. **DTO** `server/api/dtos/InvoiceDTO.ts` — Zod `safeParse` schemas (create/update), response shape without internals.
7. **Controller + routes** — chain `authenticate, requireActiveUser, resolveTenant` (+ `authorizeAdmin` or `requirePlan('pro',...)` as needed); read org from `req.tenant`; enqueue jobs for emails/receipts.
8. **Tests** — service tests with in-file doubles; adapter test with `migrate(db)` on `:memory:`; middleware behavior if you add gates. No HTTP auth tests (rate limiters) — test services.
9. **Frontend** `src/features/invoices/` — `api/` (axios via `@/lib/axios`), TanStack Query hooks, pages. Auth is cookie-based; just call and handle 401 (redirect login) / 403+`upgrade_required` (upsell) / 403+`email_unverified` (verify nudge).

## 3. Conventions to follow

- **IDs:** `crypto.randomUUID()`; timestamps ISO-8601 TEXT; money as integer minor units (never float).
- **Single-use tokens:** `tokenStore.createAuthToken` / `consumeAuthToken` (atomic); TTLs: verify 24h, reset 1h, invite 7d.
- **Sessions:** `authService.issueSession()` mints pairs; credential change must `revokeAllForUser()`; logout revokes presented refresh.
- **Billing:** one `subscriptions` row per org exists from birth; gate with `requirePlan(...)`; only a provider webhook may write plans (`updatePlan`).
- **Audit** security events (`audit('invoice.paid', userId, {...})`); **log** with `logger.forRequest(req)`; check `GET /api/metrics` (admin) after load changes.
- **Cookies:** httpOnly + `secure` (prod) + `sameSite: lax`; keep set/clear flags mirrored.

## 4. Common mistakes (do not)

- Accepting `role`, `orgId`, or `plan` from client input. Ever.
- Querying tenant data without `orgId`. Ever.
- Storing a token/password in plaintext, or returning one in a GET response.
- Awaiting mail/provider APIs inside controllers.
- Editing `001_init.sql` or any applied migration.
- Committing `data/` (DB, outbox, logs) — gitignored per-environment.
- Adding a second auth mechanism before reading `authenticate.ts` + `requireActiveUser.ts` comments.

## 5. Launch checklist

Postgres adapter + `DATABASE_URL` → SMTP/`Mailer` provider → Stripe webhook → `requireVerified` on chosen routes → `requirePlan` on paid routes → `ERROR_WEBHOOK_URL` → `JWT_SECRET` from secrets manager → `npm start` behind TLS proxy (`TRUST_PROXY` set).
