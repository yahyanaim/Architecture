import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { billingRepository, orgRepository, userRepository, membershipRepository, jobQueue } from '../../infrastructure/repositories/SharedUserRepository';
import { BillingService } from '../../domain/services/BillingService';
import { Plan } from '../../domain/entities/Subscription';
import { authenticate } from '../middleware/authenticate';
import { createRequireActiveUser, ActiveUserRequest } from '../middleware/requireActiveUser';
import { resolveTenant } from '../middleware/resolveTenant';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { audit } from '../../infrastructure/audit';
import { logger } from '../../infrastructure/observability';
import {
  APP_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE,
} from '../../config/index';
import { StripeClient, verifyWebhookSignature, priceToPlan } from '../../infrastructure/billing';

const router = Router();
const requireActiveUser = createRequireActiveUser(userRepository);
const billingService = new BillingService(billingRepository, orgRepository);
const stripe = new StripeClient(STRIPE_SECRET_KEY);

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many billing attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const CheckoutSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  seats: z.number().int().min(1).max(1000).optional(),
});

function toSubJson(sub: {
  orgId: string; plan: Plan; status: string; provider: string;
  currentPeriodEnd: Date | null; graceUntil: Date | null; customerRef: string | null;
  seats?: number;
  hasAccess(): boolean;
}, usedSeats = 1) {
  return {
    orgId: sub.orgId,
    plan: sub.plan,
    status: sub.status,
    provider: sub.provider,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    // Dunning visibility: UI shows "update payment method, N days left".
    access: sub.hasAccess(),
    graceUntil: sub.graceUntil?.toISOString() ?? null,
    hasPaymentMethod: sub.customerRef !== null,
    seats: sub.seats ?? 5,
    usedSeats,
  };
}

// BILLING SEAM — reads. `requirePlan` middleware (not this route) enforces.
router.get('/subscription', authenticate, requireActiveUser, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = req as ActiveUserRequest;
    const sub = await billingRepository.findByOrgId(r.tenant!.orgId);
    if (!sub) {
      res.status(404).json({ message: 'No subscription found for this workspace' });
      return;
    }
    const memberCount = await membershipRepository.countByOrg(r.tenant!.orgId);
    res.json(toSubJson(sub, memberCount));
  } catch (error) {
    next(error);
  }
});

// Creates a Stripe Checkout Session for plan upgrade with quantity (seats). Fails EXPLICITLY (501)
// when billing isn't configured — never a confusing 500.
router.post('/checkout', authenticate, requireActiveUser, resolveTenant, checkoutLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!stripe.enabled) {
      res.status(501).json({ message: 'Billing is not configured', code: 'billing_not_configured' });
      return;
    }
    const parsed = CheckoutSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationException('Invalid input data', parsed.error.format());
    const r = req as ActiveUserRequest;
    const priceId = parsed.data.plan === 'pro' ? STRIPE_PRICE_PRO : STRIPE_PRICE_ENTERPRISE;
    if (!priceId) {
      res.status(501).json({ message: `No price configured for plan ${parsed.data.plan}`, code: 'billing_not_configured' });
      return;
    }
    const sub = await billingRepository.findByOrgId(r.tenant!.orgId);
    const session = await stripe.createCheckoutSession({
      orgId: r.tenant!.orgId,
      plan: parsed.data.plan,
      priceId,
      customerEmail: r.account!.email,
      customerId: sub?.customerRef ?? undefined,
      quantity: parsed.data.seats ?? 1,
      successUrl: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP_URL}/billing`,
    });
    audit('billing.checkout_created', r.account!.id, { orgId: r.tenant!.orgId, plan: parsed.data.plan, seats: parsed.data.seats ?? 1 });
    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Update seat count directly
const UpdateSeatsSchema = z.object({
  seats: z.number().int().min(1).max(1000),
});

router.post('/seats', authenticate, requireActiveUser, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateSeatsSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationException('Invalid input data', parsed.error.format());
    const r = req as ActiveUserRequest;
    const sub = await billingService.updateSeats(r.tenant!.orgId, parsed.data.seats);
    audit('billing.seats_updated', r.account!.id, { orgId: r.tenant!.orgId, seats: parsed.data.seats });
    const memberCount = await membershipRepository.countByOrg(r.tenant!.orgId);
    res.json(toSubJson(sub, memberCount));
  } catch (error) {
    next(error);
  }
});

// Customer portal (self-serve cancel / payment-method update).
router.post('/portal', authenticate, requireActiveUser, resolveTenant, checkoutLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!stripe.enabled) {
      res.status(501).json({ message: 'Billing is not configured', code: 'billing_not_configured' });
      return;
    }
    const r = req as ActiveUserRequest;
    const sub = await billingRepository.findByOrgId(r.tenant!.orgId);
    if (!sub?.customerRef) {
      res.status(400).json({ message: 'No Stripe customer yet — subscribe first', code: 'no_customer' });
      return;
    }
    const session = await stripe.createPortalSession(sub.customerRef, `${APP_URL}/billing`);
    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// List invoices for workspace
router.get('/invoices', authenticate, requireActiveUser, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = req as ActiveUserRequest;
    const sub = await billingRepository.findByOrgId(r.tenant!.orgId);
    if (!sub) {
      res.json([]);
      return;
    }

    if (stripe.enabled && sub.customerRef) {
      try {
        const stripeInvoices = await stripe.listInvoices(sub.customerRef);
        const mapped = stripeInvoices.map((inv: any) => ({
          id: inv.id,
          number: inv.number ?? (inv.id ? inv.id.slice(-8).toUpperCase() : 'INV'),
          amount: (inv.amount_paid ?? inv.total ?? 0) / 100,
          currency: (inv.currency ?? 'usd').toUpperCase(),
          status: inv.status === 'paid' ? 'paid' : (inv.status === 'open' ? 'open' : 'past_due'),
          date: new Date((inv.created ?? Date.now() / 1000) * 1000).toISOString(),
          pdfUrl: inv.invoice_pdf ?? inv.hosted_invoice_url ?? null,
        }));
        res.json(mapped);
        return;
      } catch (err) {
        logger.warn('[billing] failed to fetch stripe invoices, returning mock', { error: err });
      }
    }

    // Default mock invoices for dev/demo workspaces
    const mockInvoices = [
      {
        id: `inv_${r.tenant!.orgId.slice(0, 8)}_1`,
        number: `INV-${new Date().getFullYear()}-001`,
        amount: sub.plan === 'enterprise' ? 299 : (sub.plan === 'pro' ? 29 * (sub.seats ?? 5) : 0),
        currency: 'USD',
        status: sub.status === 'past_due' ? 'past_due' : 'paid',
        date: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        pdfUrl: null,
      },
    ];
    res.json(mockInvoices);
  } catch (error) {
    next(error);
  }
});

// Metered usage tracking
const RecordUsageSchema = z.object({
  eventName: z.string().min(1).max(100),
  quantity: z.number().int().min(1).default(1),
  idempotencyKey: z.string().max(255).optional(),
});

router.post('/usage', authenticate, requireActiveUser, resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RecordUsageSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationException('Invalid input data', parsed.error.format());
    const r = req as ActiveUserRequest;
    const usageEvent = await (billingRepository as any).recordUsage({
      orgId: r.tenant!.orgId,
      eventName: parsed.data.eventName,
      quantity: parsed.data.quantity,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    res.status(201).json(usageEvent);
  } catch (error) {
    next(error);
  }
});

export { router as billingRoutes };

// ---------------------------------------------------------------------------
// Stripe webhook. Mounted in app.ts as:
//   app.use('/api/billing/webhook', express.raw({type:'application/json'}), billingWebhook)
// BEFORE express.json() — signature verification needs RAW bytes; a parsed
// body would break the HMAC. No rate limiter: Stripe retries are legitimate
// traffic and the HMAC (401 on failure) is the gate, not throttling.
// ---------------------------------------------------------------------------
const webhook = Router();

webhook.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      res.status(503).json({ message: 'Billing webhook not configured' });
      return;
    }
    const signature = req.headers['stripe-signature'] as string | undefined;
    const raw = (req as any).body as Buffer; // express.raw() gives a Buffer
    if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature, STRIPE_WEBHOOK_SECRET)) {
      res.status(401).json({ message: 'Invalid webhook signature' });
      return;
    }

    const event = JSON.parse(raw.toString('utf-8')) as { id: string; type: string; data: { object: any } };
    // IDEMPOTENCY FIRST: Stripe redelivers; second delivery of the same
    // event_id answers 200 WITHOUT re-applying (no double plan flips).
    const first = await billingService.claimEvent(event.id, event.type);
    if (!first) {
      res.json({ received: true, duplicate: true });
      return;
    }

    const obj = event.data?.object ?? {};
    switch (event.type) {
      case 'checkout.session.completed': {
        // Prefer our own metadata (set at session creation); fall back to a
        // live subscription fetch mapping price -> plan.
        const orgId: string | undefined = obj.metadata?.orgId ?? obj.client_reference_id;
        let plan: Plan | null = obj.metadata?.plan === 'pro' || obj.metadata?.plan === 'enterprise'
          ? obj.metadata.plan
          : null;
        let seats: number | undefined = obj.metadata?.seats ? parseInt(obj.metadata.seats, 10) : undefined;
        if ((!plan || seats === undefined) && obj.subscription) {
          const sub = await stripe.getSubscription(obj.subscription);
          if (!plan) {
            plan = priceToPlan(sub?.items?.data?.[0]?.price?.id, { pro: STRIPE_PRICE_PRO, enterprise: STRIPE_PRICE_ENTERPRISE });
          }
          if (seats === undefined && sub?.items?.data?.[0]?.quantity) {
            seats = Number(sub.items.data[0].quantity);
          }
        }
        if (!orgId || !plan) {
          logger.warn('[billing] checkout completed without resolvable org/plan', { eventId: event.id });
          break;
        }
        const updated = await billingService.completeCheckout({
          orgId, plan, subscriptionId: obj.subscription ?? 'unknown', customerId: obj.customer ?? null, seats,
        });
        audit('billing.subscription_started', updated.orgId, { plan, seats: updated.seats, eventId: event.id });
        break;
      }
      case 'customer.subscription.updated': {
        const priceId: string | undefined = obj?.items?.data?.[0]?.price?.id;
        const quantity: number | undefined = obj?.items?.data?.[0]?.quantity ?? obj?.quantity;
        const updated = await billingService.syncSubscription({
          subscriptionId: obj.id,
          stripeStatus: obj.status,
          pricePlan: priceToPlan(priceId, { pro: STRIPE_PRICE_PRO, enterprise: STRIPE_PRICE_ENTERPRISE }),
          seats: typeof quantity === 'number' ? quantity : (quantity ? parseInt(String(quantity), 10) : undefined),
        });
        audit('billing.subscription_updated', updated.orgId, { status: updated.status, seats: updated.seats, eventId: event.id });
        break;
      }
      case 'customer.subscription.deleted': {
        const updated = await billingService.cancelSubscription(obj.id);
        audit('billing.subscription_canceled', updated.orgId, { eventId: event.id });
        break;
      }
      case 'invoice.payment_failed': {
        // DUNNING: past_due + 7-day grace (access continues; see hasAccess).
        // subscription id may sit on the invoice when the subscription
        // object itself isn't embedded.
        const subscriptionId: string | undefined = obj.subscription ?? obj.subscription_details?.subscription;
        if (!subscriptionId) {
          logger.warn('[billing] payment_failed without subscription', { eventId: event.id });
          break;
        }
        const updated = await billingService.recordPaymentFailure(subscriptionId);
        audit('billing.payment_failed', updated.orgId, { graceUntil: updated.graceUntil, eventId: event.id });

        // Enqueue dunning emails for Day 0, Day 3, and Day 7
        try {
          const admins = await userRepository.findAllByOrg(updated.orgId);
          const admin = admins.find((u) => u.role === 'admin') ?? admins[0];
          const email = obj.customer_email ?? admin?.email;
          if (email && jobQueue) {
            const nowMs = Date.now();
            jobQueue.enqueue('billing.dunning', {
              orgId: updated.orgId,
              subscriptionId,
              email,
              day: 0,
              graceUntil: updated.graceUntil?.toISOString(),
            }).catch(() => undefined);

            jobQueue.enqueue('billing.dunning', {
              orgId: updated.orgId,
              subscriptionId,
              email,
              day: 3,
              graceUntil: updated.graceUntil?.toISOString(),
            }, { runAt: new Date(nowMs + 3 * 86_400_000) }).catch(() => undefined);

            jobQueue.enqueue('billing.dunning', {
              orgId: updated.orgId,
              subscriptionId,
              email,
              day: 7,
              graceUntil: updated.graceUntil?.toISOString(),
            }, { runAt: new Date(nowMs + 7 * 86_400_000) }).catch(() => undefined);
          }
        } catch (queueErr) {
          logger.warn('[billing] failed to enqueue dunning email jobs', { error: queueErr });
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const subscriptionId: string | undefined = obj.subscription;
        if (subscriptionId) {
          const updated = await billingService.recordPaymentSuccess(subscriptionId);
          audit('billing.payment_succeeded', updated.orgId, { eventId: event.id });
        }
        break;
      }
      default:
        logger.info('[billing] unhandled event type', { type: event.type, eventId: event.id });
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

export { webhook as billingWebhook };

