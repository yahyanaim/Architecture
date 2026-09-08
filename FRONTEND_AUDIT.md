# AUDIT — Frontend Assessment

**Date:** September 2026 · **Method:** code read (all of `src/`) + executed verification
**Evidence (this session):** `tsc --noEmit` clean · Vitest **15 files / 84 pass**
(incl. validator units, form-submission cases, router guards) · live: deep
links serve 200, email-verify link 302s · `vite build`: 5 lazy page chunks
(main 789KB → split) · grep: no token in web storage, no `location.reload`,
no stray `console.*` (except the error-boundary reporter, by design).

## Verdict

**Solid SPA shell for a SaaS starter (8.5/10, was 8).** All six gaps from
the prior cycle are fixed (see table). Remaining work is iterative polish,
not structure.

## Scores

| Domain | Score | Basis |
|--------|-------|-------|
| Routing & navigation | 9/10 | 9 real routes, RequireAuth/GuestOnly guards, upgrade redirect, back/refresh-safe |
| Auth integration | 9/10 | httpOnly cookies only; login/register/invite-accept/reset flows complete; verified banner |
| Billing UI | 8/10 | Pricing, settings w/ dunning banner, portal/checkout redirects, global 403 handler + tested predicate |
| Data fetching | 8/10 | Per-feature API modules, Query invalidation, bounded retry; 403 retried once (wasteful, harmless) |
| UX states | 8/10 | Loading/empty/error/toasts throughout; ErrorBoundary at root; ThemeProvider |
| Forms & validation | 8/10 | One shared validator mirroring Zod, contract-tested; login aligned to backend |
| Bundle & perf | 8/10 | 5 lazy route chunks; main chunk still large, manualChunks possible |
| Testing | 8/10 | Guards, predicate, validator, form-submission cases; no E2E |
| Accessibility | 7/10 | Labels, per-route titles, scroll reset; dialog SR behavior unverified |

## Why it holds up

1. **Routing is structural now.** Guards live on routes, not in page code — a new protected page nests under `RequireAuth` and cannot forget auth.
2. **No credential in JS.** Grep-verified: no `localStorage`/`sessionStorage` token handling anywhere (the one hit is the test-setup mock).
3. **Email links resolve.** `/invite` and `/reset-password` consume single-use tokens; `/login?verified=1` confirms verification — the full auth loop closes in-browser.
4. **Plan gates degrade gracefully.** `upgrade_required` routes to pricing; dunning shows a countdown + portal push, never a dead end.
5. **No reload hacks.** Account delete navigates; only Stripe leaves the SPA (required).

## Gaps — all fixed this cycle

| # | Gap | Fix |
|---|-----|-----|
| 1 | Password rules in 3 places, login weaker than backend | `features/auth/lib/password.ts` single source mirroring Zod; login aligned to backend (required only); used by Register/Profile/Invite/Reset |
| 2 | Single 695KB bundle | `React.lazy` route splitting — 5 page chunks, main shell separate (verified in build output) |
| 3 | No form-submission tests | `auth-forms.test.tsx` (user-event: empty-login blocked, valid login calls API, register mismatch blocked) + `password.test.ts` contract tests |
| 4 | Retry on 401/403/404 | `retry` predicate skips 401/403/404/422, one retry otherwise — gated redirects fire immediately |
| 5 | Generic toasts | `lib/errors.ts apiErrorMessage()` in every catch — backend reasons reach user/support |
| 6 | No focus/scroll management | `RouteChrome`: per-route `document.title` + scroll reset on navigation |

**Watch items (non-blocking):** dialog screen-reader behavior still unverified; E2E suite absent; bundle main chunk still ~789KB (react-router added — further manualChunks possible).
