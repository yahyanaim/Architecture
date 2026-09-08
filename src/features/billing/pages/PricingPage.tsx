import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi, BillingPlan } from '../api/billingApi';
import { toast } from 'sonner';
import { Loader2, Check, ArrowLeft } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';

interface PricingPageProps {
  onBack?: () => void;
}

const TIERS: { plan: BillingPlan; price: string; blurb: string; features: string[] }[] = [
  {
    plan: 'free',
    price: '$0',
    blurb: 'For trying things out',
    features: ['1 workspace', 'Core features', 'Community support'],
  },
  {
    plan: 'pro',
    price: '$19/mo',
    blurb: 'For growing workspaces',
    features: ['Everything in Free', 'Unlimited projects', 'Priority support', 'Email receipts'],
  },
  {
    plan: 'enterprise',
    price: 'Custom',
    blurb: 'For organizations',
    features: ['Everything in Pro', 'SSO & audit log', 'Dedicated support', 'Custom contracts'],
  },
];

export function PricingPage({ onBack }: PricingPageProps) {
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: billingApi.getSubscription,
    retry: false,
  });
  const currentPlan = subscription?.plan;

  const choose = async (plan: BillingPlan) => {
    if (plan === 'free') return; // free tier has no checkout; button never rendered for it
    setPendingPlan(plan);
    try {
      const { url } = await billingApi.createCheckout(plan);
      // Stripe-hosted checkout — full redirect, not SPA navigation.
      window.location.href = url;
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Could not start checkout'));
    } finally {
      setPendingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-black mb-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-black">Pricing</h1>
          <p className="text-gray-500 mt-2">Start free, upgrade when you grow.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const isCurrent = currentPlan === tier.plan;
            const isPending = pendingPlan === tier.plan;
            return (
              <div
                key={tier.plan}
                className={`bg-white p-6 rounded-2xl border shadow-sm flex flex-col ${
                  tier.plan === 'pro' ? 'border-black' : 'border-gray-200'
                }`}
              >
                <h2 className="text-lg font-semibold text-black capitalize">{tier.plan}</h2>
                <p className="text-3xl font-bold text-black mt-2">{tier.price}</p>
                <p className="text-sm text-gray-500 mt-1">{tier.blurb}</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600 flex-grow">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-black" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <span className="block text-center text-sm font-medium text-gray-500 py-2.5">Current plan</span>
                  ) : tier.plan === 'free' ? (
                    <span className="block text-center text-sm text-gray-400 py-2.5">Downgrade via support</span>
                  ) : (
                    <button
                      onClick={() => choose(tier.plan)}
                      disabled={isPending}
                      className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      Upgrade to {tier.plan}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
