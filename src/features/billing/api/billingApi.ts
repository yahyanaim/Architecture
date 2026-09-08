import axios from 'axios';
import { apiClient } from '@/lib/axios';

export type BillingPlan = 'free' | 'pro' | 'enterprise';

export interface SubscriptionInfo {
  orgId: string;
  plan: BillingPlan;
  status: string;
  provider: string;
  currentPeriodEnd: string | null;
  /** Whether requirePlan gates currently pass (incl. dunning grace). */
  access: boolean;
  /** Dunning grace expiry (ISO) or null — show "update payment method" while set. */
  graceUntil: string | null;
  hasPaymentMethod: boolean;
}

/**
 * Pure predicate: is this failure a plan-gate rejection? Used by the global
 * axios interceptor (see lib/axios.ts) to route to pricing instead of
 * showing a generic error. Exported + unit-tested; keep logic here so the
 * interceptor stays a thin dispatcher.
 */
export function isUpgradeRequired(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const data = error.response?.data as { code?: string } | undefined;
  return error.response?.status === 403 && data?.code === 'upgrade_required';
}

export const billingApi = {
  getSubscription: async (): Promise<SubscriptionInfo> => {
    const response = await apiClient.get('/billing/subscription');
    return response.data;
  },

  /** Creates a Stripe Checkout Session; caller redirects to the returned URL. */
  createCheckout: async (plan: 'pro' | 'enterprise'): Promise<{ url: string }> => {
    const response = await apiClient.post('/billing/checkout', { plan });
    return response.data;
  },

  /** Creates a Stripe customer-portal session for self-serve management. */
  createPortal: async (): Promise<{ url: string }> => {
    const response = await apiClient.post('/billing/portal');
    return response.data;
  },
};
