import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../api/billingApi';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  Users,
  CheckCircle2,
  Download,
  ExternalLink,
  Plus,
  Minus,
  Receipt,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';

interface BillingSettingsProps {
  onNavigateToPricing?: () => void;
  onBack?: () => void;
}

export function BillingSettings({ onNavigateToPricing, onBack }: BillingSettingsProps) {
  const queryClient = useQueryClient();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const { data: sub, isLoading, error } = useQuery({
    queryKey: ['subscription'],
    queryFn: billingApi.getSubscription,
    retry: false,
  });

  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: billingApi.getInvoices,
    retry: false,
  });

  const [desiredSeats, setDesiredSeats] = useState<number>(5);

  useEffect(() => {
    if (sub?.seats) {
      setDesiredSeats(sub.seats);
    }
  }, [sub?.seats]);

  const updateSeatsMutation = useMutation({
    mutationFn: (seats: number) => billingApi.updateSeats(seats),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription'], updated);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`Successfully updated workspace to ${updated.seats} seats`);
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, 'Failed to update seats allocation'));
    },
  });

  const openPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const { url } = await billingApi.createPortal();
      window.location.href = url;
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Could not open billing portal'));
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const graceDays = sub?.graceUntil
    ? Math.max(0, Math.ceil((new Date(sub.graceUntil).getTime() - Date.now()) / 86_400_000))
    : 0;

  const currentSeats = sub?.seats ?? 5;
  const usedSeats = sub?.usedSeats ?? 1;
  const seatPrice = sub?.plan === 'enterprise' ? 49 : 29;
  const hasSeatChanges = desiredSeats !== currentSeats;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setDesiredSeats(val);
  };

  const handleIncrement = () => {
    setDesiredSeats((prev) => Math.min(50, prev + 1));
  };

  const handleDecrement = () => {
    setDesiredSeats((prev) => Math.max(Math.max(1, usedSeats), prev - 1));
  };

  const handleSaveSeats = () => {
    updateSeatsMutation.mutate(desiredSeats);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </button>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 flex items-center gap-3">
              Billing & Subscriptions
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Workspace
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your plan, team seats capacity, and review past invoices.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            Could not load subscription details. Please check your connection and try again.
          </div>
        )}

        {sub && (
          <div className="space-y-6">
            {/* Dunning Alert Banner */}
            {sub.status === 'past_due' && sub.graceUntil && (
              <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50 p-5 text-amber-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-amber-950">Payment Action Required</h2>
                    <p className="text-sm text-amber-800/90 mt-0.5">
                      Your latest invoice payment failed. Your workspace will retain active access for{' '}
                      <span className="font-bold underline">{graceDays} more day{graceDays === 1 ? '' : 's'}</span>. Please
                      update your billing method before access is suspended.
                    </p>
                  </div>
                </div>
                <button
                  onClick={openPortal}
                  disabled={isOpeningPortal}
                  className="whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition shadow-sm"
                >
                  {isOpeningPortal ? 'Redirecting…' : 'Update Payment Method'}
                </button>
              </div>
            )}

            {/* Plan Overview Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-50/50 via-transparent to-transparent pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-slate-900 capitalize">
                      {sub.plan} Plan
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                        sub.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : sub.status === 'past_due'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          sub.status === 'active'
                            ? 'bg-emerald-500'
                            : sub.status === 'past_due'
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-blue-500'
                        }`}
                      />
                      {sub.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {sub.currentPeriodEnd
                      ? `Next renewal cycle on ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                      : 'Free starter tier with unlimited workspace lifetime'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={openPortal}
                    disabled={isOpeningPortal || !sub.hasPaymentMethod}
                    title={sub.hasPaymentMethod ? undefined : 'Subscribe to a paid plan first'}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {isOpeningPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 text-slate-600" />}
                    Manage in Stripe
                  </button>
                  {onNavigateToPricing && (
                    <button
                      onClick={onNavigateToPricing}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-slate-950 hover:bg-slate-800 transition-all shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" /> Change Plan
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Role-Based Access Control</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Outbound Webhook Relays</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Standardized REST v1 APIs</span>
                </div>
              </div>
            </div>

            {/* Interactive Seats Slider Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-lg font-bold text-slate-900">Seats & Member Capacity</h2>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Workspaces dynamically scale with your team. Adjust seat limits below.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {usedSeats} <span className="text-sm font-normal text-slate-500">/ {currentSeats} seats in use</span>
                  </span>
                </div>
              </div>

              {/* Progress visualizer */}
              <div className="space-y-2">
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      usedSeats >= currentSeats ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(100, (usedSeats / currentSeats) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>{usedSeats} active member{usedSeats === 1 ? '' : 's'}</span>
                  <span>{Math.max(0, currentSeats - usedSeats)} seat{currentSeats - usedSeats === 1 ? '' : 's'} remaining</span>
                </div>
              </div>

              {/* Interactive Range Slider */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Target Seat Allocation</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      disabled={desiredSeats <= Math.max(1, usedSeats)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
                      aria-label="Decrease seats"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-lg font-bold text-slate-900">
                      {desiredSeats}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      disabled={desiredSeats >= 50}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
                      aria-label="Increase seats"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min={Math.max(1, usedSeats)}
                  max="50"
                  value={desiredSeats}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-sm border-t border-slate-200/60">
                  <div className="text-slate-600">
                    Pricing: <span className="font-semibold text-slate-900">${seatPrice}</span>/seat/month &bull; Estimated Total:{' '}
                    <span className="font-bold text-indigo-700">${desiredSeats * seatPrice}/mo</span>
                  </div>
                  <button
                    onClick={handleSaveSeats}
                    disabled={!hasSeatChanges || updateSeatsMutation.isPending}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                  >
                    {updateSeatsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Apply Seat Limit ({desiredSeats})
                  </button>
                </div>
              </div>
            </div>

            {/* Invoices List Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Invoices & Receipts</h2>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {invoices.length} record{invoices.length === 1 ? '' : 's'}
                </span>
              </div>

              {isLoadingInvoices ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
                  No invoices generated yet for this workspace.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xs font-medium uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Invoice</th>
                        <th className="pb-3 font-semibold">Date</th>
                        <th className="pb-3 font-semibold">Amount</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 text-right font-semibold">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 font-medium text-slate-900 flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-slate-400" />
                            {inv.number}
                          </td>
                          <td className="py-3.5 text-slate-600">
                            {new Date(inv.date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 font-semibold text-slate-900">
                            ${inv.amount.toFixed(2)} {inv.currency}
                          </td>
                          <td className="py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                inv.status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : inv.status === 'past_due'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            {inv.pdfUrl ? (
                              <a
                                href={inv.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                <Download className="w-3.5 h-3.5" /> PDF
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toast.info(`Receipt ${inv.number} is archived`)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> View
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
