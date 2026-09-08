# AUDIT — Solid Starter SaaS Assessment

**Date:** September 2026 · **Method:** code read (all layers) + executed verification
**Evidence (this session):** `tsc --noEmit` clean · Vitest **9 files / 54 tests pass** ·
live server: `GET /health` 200, unauthenticated `/api/users` 401 ·
SQLite live: 8 tables, migration `001_init` applied, 4 users / 2 orgs / 2 subscriptions / 3 jobs ·
secret scan clean · no sensitive files tracked in git.

## Verdict

**This is a solid SaaS starter (8.5/10).** Identity, tenancy, billing seam,
background work, and observability exist and are wired together — not stubbed
slides. It is MVP-launchable on SQLite; Postgres + provider wiring are the
gated path to scale, both prepared for. Details per domain below.

## Scores

| Domain | Score | Basis |
|--------|-------|-------|
| Architecture & layering | 9/10 | Real ports/adapters, DI, one composition root, env isolated in config |
| Authentication & sessions | 9/10 | Access+rotating refresh, reuse detection, lockout, 3 throttle layers |
| Multi-tenancy | 8/10 | Org-scoped ports/queries/middleware; single-org-per-user (documented limit) |
| Billing readiness | 7/10 | Row-per-org seam + `requirePlan` + subscription endpoint; no provider yet |
| Background jobs & mail | 8/10 | Durable queue, backoff, dead-letter, swappable `Mailer`; single-process worker |
| Data & migrations | 8/10 | Ledgered portable SQL, boot-ordered, legacy import; SQLite ceiling noted |
| Observability | 7/10 | JSON logs, metrics endpoint, 5xx hook; no distributed tracing/APM |
| Testing | 8/10 | 54 tests incl. theft, tenancy, adapters, queue; no HTTP auth tests (deliberate), no E2E |
| Docs | 9/10 | ARCHITECTURE + KICKOFF + SCENARIO + USAGE + REVIEW mutually consistent (verified by grep) |
| Repo hygiene | 10/10 | No secrets, DB, outbox, or logs tracked; runtime files gitignored |

## Why it holds up (verified strengths)

1. **Security model is a chain, not a hope.** `authenticate → requireActiveUser → resolveTenant → authorize/plan` runs on every protected route in that order; stale sessions (deleted/deactivated accounts) die on next request — proven live (403) and in tests.
2. **Theft-aware sessions.** Refresh reuse revokes the whole chain; credential change kills all sessions; single-use email tokens are hashed with atomic consume (no double-spend).
3. **Tenancy is structural.** `org_id` on tenant tables, scoped repository signatures, tenant from `req.tenant` only — a new feature following `SAAS_KICKOFF.md` cannot accidentally go cross-tenant.
4. **Fail-closed defaults.** JWT secret refuses prod boot when missing; CORS allowlist is a real array; logout mirrors cookie flags; error responses never leak internals on 5xx.
5. **Async work is durable.** Jobs survive restarts, retry with backoff, park visibly in `dead`; mail provider is one line behind a port.
6. **Every claim is tested or logged.** 54 tests cover the risky paths (rotation theft, invite, reset-kills-sessions, tenancy isolation, queue retry→dead); metrics + audit + request IDs cover runtime.

## Gaps (ranked, with effort)

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 1 | SQLite single-writer; Postgres adapter is a stub | Caps scale-out | M (needs `DATABASE_URL`; migrations already portable) |
| 2 | No mail provider (LogMailer only) | No real delivery | S (implement `Mailer` port) |
| 3 | No billing provider webhook | Plans can't be sold yet | M (webhook → `updatePlan`; seam ready) |
| 4 | Access JWT stateless ≤15m after credential change | 15-min window, accepted tradeoff | S (denylist or shorter TTL if needed) |
| 5 | Single-org-per-user; no org switching/invites-across-orgs | Limits team models | M (membership table when required) |
| 6 | No E2E / HTTP auth tests; no APM/tracing | Confidence at scale | M |
| 7 | `requireVerified`/`requirePlan` minimally wired | Must attach per-route when shipping | S (by design, documented) |

## SaaS-readiness checklist

- [x] Tenant isolation enforced in code + tests
- [x] Auth: verify/reset/invite, lockout, throttles, session revocation
- [x] Billing seam (plans readable + enforceable today)
- [x] Background jobs + audit + metrics + error hook
- [x] Migrations, seed/import, per-env runtime data
- [x] Docs an agent can build from (`SAAS_KICKOFF.md`)
- [ ] Postgres adapter (needs credentials)
- [ ] Mail + billing providers (ports ready)
- [ ] E2E suite, APM, multi-instance worker lease

**Bottom line:** start building product on it now; spend the first paid sprint on rows 1–3 of the gaps table. Nothing on that list requires re-architecture — all three plug into ports that already exist.
