import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../api/billingApi';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, CreditCard, AlertTriangle } from 'lucide-react';
import axios from 'axios';

interface BillingSettingsProps {
  onNavigateToPricing?: () => void;
  onBack?: () => void;
}

export function BillingSettings({ onNavigateToPricing, onBack }: BillingSettingsProps) {
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const { data: sub, isLoading, error } = useQuery({
    queryKey: ['subscription'],
    queryFn: billingApi.getSubscription,
    retry: false,
  });

  const openPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const { url } = await billingApi.createPortal();
      window.location.href = url;
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? 'Could not open billing portal'
        : 'Could not open billing portal';
      toast.error(message);
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const graceDays = sub?.graceUntil
    ? Math.max(0, Math.ceil((new Date(sub.graceUntil).getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-black mb-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        <h1 className="text-2xl font-bold text-black mb-6">Billing</h1>

        {isLoading && <p className="text-gray-500">Loading subscription…</p>}
        {error && <p className="text-red-500">Could not load subscription.</p>}

        {sub && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Plan</span>
              <span className="font-semibold text-black capitalize">{sub.plan}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Status</span>
              <span className="font-medium text-gray-700">{sub.status}</span>
            </div>

            {/* Dunning visibility: past_due inside grace keeps access — show
                the countdown and push to the portal, not an error page. */}
            {sub.status === 'past_due' && sub.graceUntil && (
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Last payment failed. Your workspace keeps working for {graceDays} more day{graceDays === 1 ? '' : 's'} —
                  update your payment method to stay on {sub.plan}.
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={openPortal}
                disabled={isOpeningPortal || !sub.hasPaymentMethod}
                title={sub.hasPaymentMethod ? undefined : 'No payment method yet — subscribe first'}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isOpeningPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Manage payment
              </button>
              {onNavigateToPricing && (
                <button
                  onClick={onNavigateToPricing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Change plan
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
