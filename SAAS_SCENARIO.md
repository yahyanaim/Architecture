# SAAS_SCENARIO — Building "InvoiceFlow" on This Template

> A concrete walkthrough: how a real SaaS (freelancers sending invoices, free
> tier + Pro plan) gets built on this architecture. Follow it step by step;
> every step maps to files that already exist. Companion: `SAAS_KICKOFF.md`
> (rules), `ARCHITECTURE.md` (reference).

## The product

**InvoiceFlow**: each workspace (org) manages clients and invoices. Free plan:
3 paid invoices/month. Pro: unlimited + PDF receipts by email. This exercises
everything: tenancy, paid gating, background email, audit, metrics.

## Day 0 — Bootstrap (1 hour)

1. Clone, `cp .env.example .env`, set `JWT_SECRET`, `APP_URL=https://invoiceflow.app`, `CORS_ORIGIN=https://invoiceflow.app`.
2. `npm install && npm run dev`. Register `you@invoiceflow.app` — first user becomes instance **admin** AND gets a personal org + `free/trialing` subscription row automatically.
3. Delete the demo you won't ship: the `MainApp` architecture tabs stay for marketing, but remove `CreateUserForm` usage later once invites are your flow. Keep `UserList` for the admin console.
4. Confirm green: `npm test` (54 passing), `npm run lint`, `GET /api/health`, `GET /api/metrics` (admin cookie).

## Step 1 — Tenant-scoped `Invoice` entity (the core loop)

**Migration** `server/infrastructure/db/migrations/002_invoices.sql`:
```sql
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  number TEXT NOT NULL,
  client_email TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,          -- integer money, never float
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',   -- draft|sent|paid|void
  paid_at TEXT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_org_number ON invoices(org_id, number);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);
```

**Entity** `server/domain/entities/Invoice.ts` — pure rules, zero I/O:
```ts
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';
export class Invoice {
  constructor(/* id, orgId, number, clientEmail, amountCents, ... */) {
    if (amountCents <= 0) throw new Error('Amount must be positive');
  }
  markSent() { if (this.status !== 'draft') throw new Error('Only drafts can be sent'); this.status = 'sent'; }
  markPaid() { /* sent -> paid + paidAt; else throw */ }
}
```

**Port + service + adapter** (follow `IUserRepository` → `SqliteUserRepository` as the template):
- `IInvoiceRepository`: `findByIdForOrg(id, orgId)`, `findAllByOrg(orgId)`, `save`, `delete` — org in EVERY signature.
- `InvoiceService(repo)`: `createInvoice(orgId, ...)`, `sendInvoice` (draft→sent + enqueue `email.send`), `markPaid` (+ `audit('invoice.paid', …)` + enqueue receipt job).
- `SqliteInvoiceRepository`: implement port; export singleton from `SharedUserRepository.ts`.

## Step 2 — Paid gating with the billing seam

Free = 3 paid invoices/month. The service counts via the adapter
(`countPaidSince(orgId, monthStart)`), the HTTP boundary enforces the plan:

```ts
// routes/invoiceRoutes.ts
router.post('/', authenticate, requireActiveUser, resolveTenant, invoiceController.create);
router.post('/:id/send', authenticate, requireActiveUser, resolveTenant, invoiceController.send);
router.post('/:id/pay', authenticate, requireActiveUser, resolveTenant,
  requirePlan('pro', 'enterprise'),   // unlimited + receipts live here
  invoiceController.markPaid);
```

Free-tier quota (count check) lives in the **service** (business rule);
plan identity lives in **middleware** (HTTP concern). When Stripe connects,
its webhook calls `billingRepository.updatePlan(orgId, 'pro', 'active')` —
no controller changes, because nothing except the webhook writes plans.

Frontend handles the seam's contract: `403 + code:'upgrade_required'` →
upsell screen; `403 + code:'email_unverified'` → verify nudge.

## Step 3 — Team invites (use the built-in flow, don't rebuild it)

Admin invites the freelancer's accountant: `POST /api/users {name, email}` →
account pinned to the **caller's org** + 7-day single-use link emailed via
the queue (`data/outbox/` in dev, real `Mailer` in prod). Accept sets the
password, verifies the email, and auto-logs-in. The accountant sees ONLY this
org's invoices — `findAllByOrg` guarantees it, covered by tests.

## Step 4 — Receipts by background job

`markPaid` enqueues, never sends inline:
```ts
await this.jobQueue.enqueue('email.send', {
  to: invoice.clientEmail, subject: `Receipt ${invoice.number}`,
  text: `Paid ${amount} ${currency}.`, kind: 'welcome',
});
```
Worker (10s tick) delivers with backoff; failures park in `dead` for replay;
`done` rows prune after 7d. Need PDF attachments later? Add `pdf.generate`
job type + handler — the queue already supports it.

## Step 5 — Operate it

- **Audit trail** answers "who voided invoice INV-1042?": `data/audit.log` (`invoice.paid` with actor + org).
- **Metrics** (`GET /api/metrics`, admin): watch `POST /api/invoices` counts/latency after launch; 5xx auto-reports via `reportError` → `ERROR_WEBHOOK_URL`.
- **Incident drill**: accountant's laptop stolen → admin `PATCH /users/:id/status` (sessions die on next request via `requireActiveUser`) + user hits `PUT /profile/password` (all refresh sessions revoked, caller re-minted). Stolen refresh replayed later → reuse detected → whole chain revoked.
- **Scale-up order**: `DATABASE_URL` + Postgres adapter (ports unchanged) → SMTP provider → Stripe webhook → `TRUST_PROXY` behind TLS → `npm start`.

## What you did NOT build (and why that's the point)

No custom auth, no session store, no tenant plumbing, no email infrastructure,
no audit/metrics scaffolding, no plan-gate framework. The template owned the
lifecycle; you added one entity, one service, one adapter, three routes, and
the product logic. That ratio is what the architecture is for.
