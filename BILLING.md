# BILLING — Stripe Setup & Operations

> Implementation: `server/infrastructure/billing.ts` (SDK-free client),
> `server/domain/services/BillingService.ts` (sole subscription writer),
> `server/api/routes/billingRoutes.ts` (checkout / portal / webhook).
> UI: `src/features/billing/` (pricing page, settings page, global 403 handler).

## 1. Required env vars

| Var | Purpose | Where |
|-----|---------|-------|
| `STRIPE_SECRET_KEY` | Checkout/portal session creation + subscription fetch (`sk_test_…` / `sk_live_…`) | `.env` (gitignored) |
| `STRIPE_WEBHOOK_SECRET` | HMAC verification of webhook deliveries (`whsec_…`, one per endpoint) | `.env` |
| `STRIPE_PRICE_PRO` | Price id (e.g. `price_…`) mapped to the `pro` plan | `.env` |
| `STRIPE_PRICE_ENTERPRISE` | Price id mapped to the `enterprise` plan | `.env` |
| `APP_URL` | Builds `success_url`/`cancel_url` for Checkout | `.env` |

Unset key behavior (fail-explicit, never a confusing 500): checkout/portal
answer **501** `billing_not_configured`; webhook answers **503**. Missing
price id for the requested plan also 501s.

## 2. Register the webhook in the Stripe dashboard

1. Developers → Webhooks → **Add endpoint**: `https://YOUR_DOMAIN/api/billing/webhook`
2. Subscribe to events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
3. Copy the endpoint's **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`
4. Create two recurring Prices (Pro, Enterprise), copy ids into `STRIPE_PRICE_*`

Event → state mapping (all through `BillingService`, all idempotent):

| Event | Effect |
|-------|--------|
| `checkout.session.completed` | Wire org → plan/active, store subscription + customer ids |
| `customer.subscription.updated` | Mirror status/plan (price change = plan change; unknown prices never blind-apply) |
| `customer.subscription.deleted` | `canceled`, immediate |
| `invoice.payment_failed` | `past_due` + **7-day grace** (access continues) |
| `invoice.payment_succeeded` | Back to `active`, grace cleared |

Replays of the same `event.id` answer 200 with `duplicate:true` and change nothing.

## 3. Test locally with the Stripe CLI

```bash
# 1. Log in and forward webhooks to the dev server:
stripe login
stripe listen --forward-to localhost:40001/api/billing/webhook
# → prints a whsec_test_... secret: put it in .env as STRIPE_WEBHOOK_SECRET and restart.

# 2. Trigger the flows (in another terminal):
stripe trigger checkout_session_completed \
  --add checkout_session:metadata-orgId=<ORG_ID_FROM_ME> \
  --add checkout_session:metadata-plan=pro
stripe trigger invoice_payment_failed
stripe trigger invoice_payment_succeeded
stripe trigger customer_subscription_deleted
```

Then verify: `GET /api/billing/subscription` (plan/status/`access`/`graceUntil`),
`data/` untouched by hand, and one re-delivery (`stripe events resend <id>`)
returns `duplicate:true`.

## 4. Dunning (what the customer sees)

`payment_failed` keeps the workspace working for 7 days (`graceUntil`).
The billing settings page shows a countdown banner with a portal link;
`requirePlan` gates on `hasAccess()` (active **or** in-grace past_due), so a
temporarily failed card never locks anyone out mid-grace. After expiry the
next gated request gets `403 upgrade_required` and the SPA routes to pricing.

## 5. Going live checklist

- [ ] Live `sk_live_…` + production webhook endpoint + secret (test-mode and live secrets differ)
- [ ] Real price ids in `STRIPE_PRICE_*`; confirm plan mapping with a test Checkout
- [ ] `APP_URL` = public domain (Checkout redirects depend on it)
- [ ] `stripe listen` replaced by the dashboard endpoint; old test secret revoked
