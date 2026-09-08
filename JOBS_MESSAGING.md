# Jobs + Messaging — Why It Exists

> Design rationale for the `JobQueue` + `Mailer` subsystem (`server/infrastructure/queue.ts`, `mailer.ts`).
> How it works: `ARCHITECTURE.md` ("Data & Background Flows"). How to extend it: `SAAS_KICKOFF.md` §2.

## 1. HTTP responses must never wait on the outside world

Sending an email takes 1–5 seconds and can fail (SMTP down, bad address,
network blip). If `register` awaited the mailer, every signup would be slow
and a mail outage would become a **signup outage**. Instead the controller
does `jobQueue.enqueue('email.send', …)` (~1ms SQLite insert) and returns
instantly. Delivery happens in the background. Slow/unreliable work never
blocks fast work.

## 2. Durability: nothing gets lost on crash or restart

Jobs live in the `jobs` table, not memory, so a restart mid-send loses
nothing — the worker picks the row back up. Invite/reset emails are therefore
audit-grade flows: `queued → running → done`, every state persisted. An
in-memory queue would silently drop emails on every deploy.

## 3. Retries with backoff, and honest failure

Transient failures retry automatically with exponential backoff
(2m → 4m → 8m…, capped at 60m). Permanent failures park in `dead` **visibly**
instead of vanishing — inspect and replay them. Without this, you'd never
know which users never got their verification link.

## 4. The `Mailer` port keeps providers swappable

Services build the *content* (subject, link, expiry); `mailer.send()` only
*delivers*. Today it's `LogMailer` → `data/outbox/` (zero config, fully
inspectable). Tomorrow it's SMTP/Resend/SES behind the same interface — one
line in `SharedUserRepository`, zero service changes. Business logic never
imports a mail SDK.

## 5. The seam for all future async SaaS work

Receipts, PDF generation, Stripe webhook follow-ups, reminders, reports —
any slow work gets a `type` + handler + `enqueue()` call. No new
infrastructure. (Example: `markPaid` → enqueue receipt.)

## 6. Security side-benefit

Token emails (verify/reset/invite) deliver the single-use auth tokens. The
queue guarantees at-least-once delivery attempt **with proof** (the `done`
row + `.eml` file), so "I never got the email" becomes a checkable claim
instead of a mystery.

**One-liner:** the queue turns unreliable, slow side effects into fast,
durable, retryable, inspectable units of work — which is what lets the HTTP
layer stay fast and the SaaS stay trustworthy.
