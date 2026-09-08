# Architecture Document

**Project:** Clean Architecture SaaS Starter
**Tech Stack:** React 19, Express 4, TypeScript, Vite, Tailwind CSS v4, Shadcn UI, TanStack Query, Zod, SQLite (better-sqlite3), Vitest
**Architecture Pattern:** Clean Architecture + Hexagonal (Ports and Adapters), shared-schema multi-tenancy

> Last verified: 54 tests passing, `npm run lint` clean. If code and this doc disagree, the code wins — then fix the doc.

---

## Directory Structure

```
project-root/
├── server.ts                        # Process entry: migrate() -> worker -> Vite/static -> listen
├── server/
│   ├── app.ts                       # Express composition root (middleware order = lifecycle)
│   ├── config/index.ts              # ONLY place reading process.env (JWT, CORS, TTLs, URLs)
│   ├── api/
│   │   ├── controllers/             # AuthController, UserController, ProfileController
│   │   ├── dtos/                    # Zod schemas (AuthDTO, UserDTO, ProfileDTO)
│   │   ├── middleware/              # authenticate, requireActiveUser, resolveTenant,
│   │   │                            # authorizeAdmin, requirePlan, requireVerified,
│   │   │                            # loginAccountLimiter, errorHandler, requestId
│   │   └── routes/                  # authRoutes, userRoutes, profileRoutes, billingRoutes
│   ├── domain/
│   │   ├── entities/                # User, Organization, Subscription (rules, no I/O)
│   │   ├── interfaces/              # PORTS: IUserRepository, ITenant (orgs/subs/tokens)
│   │   ├── exceptions/              # AppError, BusinessException, ValidationException, NotFoundException
│   │   └── services/                # AuthService, UserService, ProfileService (ports only)
│   └── infrastructure/
│       ├── database.ts              # better-sqlite3 handle (WAL, FK; :memory: in tests)
│       ├── db/migrate.ts            # Idempotent runner + legacy users.json import
│       ├── db/migrations/           # 001_init.sql (portable SQL, never edit applied files)
│       ├── repositories/            # Sqlite* adapters, SharedUserRepository (singletons),
│       │                            # InMemory* (tests), File* (deprecated)
│       ├── mailer.ts                # Mailer port + LogMailer (data/outbox/)
│       ├── queue.ts                 # SQLite job queue + worker (email.send, backoff, dead-letter)
│       └── observability.ts         # JSON logger, metrics, error-report hook
├── src/
│   ├── components/                  # AuthRoute, MainApp, Header, Footer, ui/*
│   ├── features/                    # auth/, users/, profile/ (API + context + pages)
│   ├── lib/                         # axios (withCredentials), react-query, utils
│   └── main.tsx / App.tsx           # ThemeProvider -> AuthProvider -> App
├── data/                            # RUNTIME, gitignored: app.db, outbox/, audit.log
└── docs: ARCHITECTURE.md (this), CODE_REVIEW.md, SAAS_KICKOFF.md, SAAS_SCENARIO.md, USAGE.md
```

---

## Layer Architecture

```
┌─────────────────────────────────────────────────┐
│  React SPA (Vite + Query + Axios, cookies)      │
└──────────────────┬──────────────────────────────┘
                   │ HTTP + httpOnly cookies
                   ▼
┌─────────────────────────────────────────────────┐
│  Express API Layer                              │
│  DTOs (Zod) -> middleware chain -> Controllers  │
│  Chain: authenticate -> requireActiveUser ->    │
│         resolveTenant -> authorize/plan gates   │
└──────────────────┬──────────────────────────────┘
                   │ calls (constructor-injected)
                   ▼
┌─────────────────────────────────────────────────┐
│  Domain Services (Auth, User, Profile)          │
│  Business rules + lifecycle. Imports PORTS only │
└──────────────────┬──────────────────────────────┘
                   │ uses
                   ▼
┌─────────────────────────────────────────────────┐
│  Ports (IUserRepository, org/sub/token ports,   │
│  Mailer) implemented by Infrastructure          │
└──────────────────┬──────────────────────────────┘
                   │ adapters
                   ▼
┌─────────────────────────────────────────────────┐
│  Infrastructure (SQLite, job queue, outbox,     │
│  audit log, metrics). Wired in ONE place:       │
│  SharedUserRepository + server.ts + app.ts      │
└─────────────────────────────────────────────────┘
```

**Dependency rule:** `API -> Domain -> Ports <- Infrastructure`. Domain files import only domain types. `process.env` is read only in `server/config` (and `server.ts` via that module).

---

## Multi-Tenancy (shared schema)

- Every user has exactly one `orgId` (workspace). Identity (email) is **global** so login needs no tenant hint; data access is **org-scoped** (`findAllByOrg`, `findByEmailAndOrg`).
- Registration bootstraps a personal org + `free/trialing` subscription row. Invites join the inviter's org.
- `resolveTenant` binds `req.tenant` from the DB-hydrated account (never from the JWT claim alone); a claim/DB mismatch means a stale token -> 401.
- Rule for new features: **every tenant table gets `org_id`, every query scopes by it, tenant comes from `req.tenant`, never from client input.**

## Session Lifecycle

- Login/register/accept-invite mint a pair: short-lived access JWT (`ACCESS_TOKEN_TTL`, default `15m`, `access` cookie) + opaque refresh token (default 30d, stored **hashed**, `refresh` cookie).
- `POST /api/auth/refresh` rotates: old row revoked + linked to replacement. Replaying a rotated token = theft signal -> **whole chain revoked**.
- Password reset / password change revokes all refresh sessions. Access JWTs are stateless and live ≤ TTL (accepted tradeoff, documented in code).
- Account states enforced at two levels: issuance (`AuthService`: active? locked?) and per-request (`requireActiveUser`: exists? active?).

## Request Lifecycle (middleware order in `app.ts`)

```
trust proxy -> rate limit (/api) -> json/cookies -> requestId -> metrics
  -> cors -> helmet -> morgan -> swagger (dev) -> routes -> errorHandler
Route chain: authenticate (401) -> requireActiveUser (401/403)
  -> resolveTenant -> authorizeAdmin (403) / requirePlan (403+upgrade_required)
  -> controller -> service -> port -> adapter
```

## Routes

### Auth (`/api/auth`)
| Method | Path | Guards | Notes |
|--------|------|--------|-------|
| POST | /register | 3/hour per IP | Creates user + org + sub; sets session; enqueues verify email |
| POST | /login | 5/15m per IP + 10/15m per account | Lockout-aware; sets session |
| POST | /refresh | — | Rotates pair; reuse detected |
| POST | /logout | — | Revokes refresh; clears cookies |
| GET | /me | auth + active | Liveness-checked profile |
| POST | /verify-request | ip limiter | Always 200 (no enumeration) |
| GET | /verify?token= | — | Single-use, 24h |
| POST | /password-reset-request | ip limiter | Always 200 |
| POST | /password-reset | ip limiter | Kills all sessions |
| POST | /invite-accept | ip limiter | Sets password, verifies, auto-login |

### Users (`/api/users`, all: auth + active + tenant + **admin**)
| Method | Path | Notes |
|--------|------|-------|
| POST | / | Invite into caller's org; emails single-use 7d link |
| GET | / | Tenant-scoped list (PII: admin-only) |
| PATCH | /:id/status | Toggle active (session kill is immediate via `requireActiveUser`) |
| DELETE | /:id | Deletes user (refresh rows cascade) |

### Profile (`/api/profile`, all: auth + active + tenant)
`GET /` read · `PUT /` update name/email · `PUT /password` change (revokes others, re-mints caller) · `DELETE /` delete own account.

### Billing / Ops
`GET /api/billing/subscription` (tenant's row incl. `access`, `graceUntil`, `hasPaymentMethod`) · `POST /api/billing/checkout` (Stripe Checkout Session, 501 when unconfigured) · `POST /api/billing/portal` (customer portal) · `POST /api/billing/webhook` (raw-body HMAC, idempotent ledger, handles checkout/sync/cancel/payment_failed/succeeded) · `GET /api/metrics` (admin-only counters) · `GET /api/health` (open).

## Data & Background Flows

- **Migrations** run at boot before listen (`migrate()`), ledgered in `schema_migrations`. New change = new `NNN_*.sql`, portable SQL, never edit applied files.
- **Jobs:** controllers `enqueue()` and return; worker (10s tick, `unref`'d, skipped in tests) leases due rows, exponential backoff, `dead` parking, 7d prune of `done`. Built-in `email.send` -> `Mailer` port (`LogMailer` to `data/outbox/` in dev).
- **Audit:** `user.registered/verified/invited/invite_accepted/password_reset/deleted/account_deleted` to stdout + `data/audit.log` (best-effort).
- **Observability:** JSON logs (`LOG_LEVEL`), per-route metrics, 5xx -> `reportError` (log + optional `ERROR_WEBHOOK_URL`).

## Security Posture

httpOnly session cookies · bcrypt hashes only · first-user-admin bootstrap (no role input) · 5-fail/15-min lockout + IP (5/15m) + per-account login (10/15m) + registration (3/hour/IP) throttles · single-use hashed tokens with sensible TTLs · Helmet + CORS allowlist · JWT fail-closed in prod · runtime DB/outbox gitignored · Swagger dev-only.

## Production image

`Dockerfile` (multi-stage): full install → `npm run build` (Vite SPA + esbuild server bundle, our code only) → prune dev deps → ship `node_modules` (prod-only, no tsx/vite) + `dist/` + `dist-server/` + `migrations/` + `package.json`. Verified: boots, migrates, serves SPA at `/` and API at `/api`. Mount `/data` (`DB_PATH`), set `JWT_SECRET`/`APP_URL`/`CORS_ORIGIN`. CI (`.github/workflows/ci.yml`) runs lint + tests on push/PR.

## Testing

```
Test Files  13 passed (13) · Tests  75 passed (75)
```
AuthService 17 (register/login/roles/rotation-theft/verify/reset/invite) · UserService 11 (invite, tenancy scoping, cross-org guards) · ProfileService 11 · BillingService 7 (checkout/dunning/idempotency) · billing client 6 (HMAC, price map) · billing UI predicate 2 (upgrade_required routing) · requireActiveUser 4 · requirePlan 5 (incl. dunning grace) · tenancy guard 2 · SQLite adapters 4 (incl. webhook ledger) · job queue 3 · health 1 · App render 2.
Conventions: services tested against in-file doubles; adapters + queue against real isolated `:memory:` SQLite (`migrate(db)` in `beforeAll`); architecture tripwire `server/tenancy-guard.test.ts` (SQL org-scope + route-chain order, closed-by-default for new route files); no HTTP tests except health (rate limiters make HTTP auth tests flaky — test services instead).
