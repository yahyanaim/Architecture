import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { billingRepository, orgRepository, userRepository } from '../../infrastructure/repositories/SharedUserRepository';
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
});

function toSubJson(sub: {
  orgId: string; plan: Plan; status: string; provider: string;
  currentPeriodEnd: Date | null; graceUntil: Date | null; customerRef: string | null;
  hasAccess(): boolean;
}) {
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
    res.json(toSubJson(sub));
  } catch (error) {
    next(error);
  }
});

// Creates a Stripe Checkout Session for plan upgrade. Fails EXPLICITLY (501)
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
      successUrl: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP_URL}/billing`,
    });
    audit('billing.checkout_created', r.account!.id, { orgId: r.tenant!.orgId, plan: parsed.data.plan });
    res.json({ url: session.url });
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
        if (!plan && obj.subscription) {
          const sub = await stripe.getSubscription(obj.subscription);
          plan = priceToPlan(sub?.items?.data?.[0]?.price?.id, { pro: STRIPE_PRICE_PRO, enterprise: STRIPE_PRICE_ENTERPRISE });
        }
        if (!orgId || !plan) {
          logger.warn('[billing] checkout completed without resolvable org/plan', { eventId: event.id });
          break;
        }
        const updated = await billingService.completeCheckout({
          orgId, plan, subscriptionId: obj.subscription ?? 'unknown', customerId: obj.customer ?? null,
        });
        audit('billing.subscription_started', updated.orgId, { plan, eventId: event.id });
        break;
      }
      case 'customer.subscription.updated': {
        const priceId: string | undefined = obj?.items?.data?.[0]?.price?.id;
        const updated = await billingService.syncSubscription({
          subscriptionId: obj.id,
          stripeStatus: obj.status,
          pricePlan: priceToPlan(priceId, { pro: STRIPE_PRICE_PRO, enterprise: STRIPE_PRICE_ENTERPRISE }),
        });
        audit('billing.subscription_updated', updated.orgId, { status: updated.status, eventId: event.id });
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
