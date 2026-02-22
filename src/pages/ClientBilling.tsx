"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Loader2, DollarSign, FileText, ExternalLink, Zap, CreditCard, CheckCircle2, AlertTriangle, Download, X, Mic2, TrendingUp } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import { ClientBillingService } from '../services/clientBillingService';
import ServiceStatusBanner from '../components/ServiceStatusBanner';
import CancelSubscriptionModal from '../components/CancelSubscriptionModal';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  amount_due: number;
  status: string;
  hosted_invoice_url: string;
  pdf_url: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  stripe_price_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface Deposit {
  id: string;
  amount_cents: number;
  status: 'paid' | 'pending' | 'failed' | 'applied';
  applied_to_invoice_id: string | null;
  created_at: string;
}

interface BillingProduct {
  id: string;
  name: string;
  stripe_price_id: string;
}

interface VoiceUsage {
  voice_active: boolean;
  total_calls: number;
  total_minutes: number;
  budget_cents: number;
}

const ClientBilling: React.FC = () => {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [isClientRecordMissing, setIsClientRecordMissing] = useState(false);
  const [clientServiceStatus, setClientServiceStatus] = useState<'active' | 'paused' | 'onboarding' | 'completed'>('onboarding');
  
  // AI Voice usage state
  const [voiceUsage, setVoiceUsage] = useState<VoiceUsage | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetSuccess, setBudgetSuccess] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationTarget, setCancellationTarget] = useState<Subscription | null>(null);
  const [cancellationSuccess, setCancellationSuccess] = useState(false);
  const [cancellationEffectiveDate, setCancellationEffectiveDate] = useState<string | null>(null);


  const fetchBillingData = async () => {
    if (!profile) return;
    setIsLoading(true);

    // 1. Find the client record associated with the user's profile ID
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, stripe_customer_id, service_status, cancellation_effective_date')
      .eq('owner_profile_id', profile.id)
      .single();

    if (clientError && clientError.code !== 'PGRST116') {
        console.error('Error fetching client record:', clientError);
        setIsClientRecordMissing(true);
        setIsLoading(false);
        return;
    }
    
    if (!clientData) {
        setIsClientRecordMissing(true);
        setIsLoading(false);
        return;
    }
    
    const clientId = clientData.id;
    setClientId(clientId);
    setStripeCustomerId(clientData.stripe_customer_id);
    setClientServiceStatus(clientData.service_status as any);
    setCancellationEffectiveDate(clientData.cancellation_effective_date);
    setIsClientRecordMissing(false);

    // 2. Fetch invoices for that client ID (exclude retracted — clients should never see these)
    const { data: invoicesData, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, amount_due, status, hosted_invoice_url, pdf_url, created_at')
      .eq('client_id', clientId)
      .neq('status', 'retracted')
      .order('created_at', { ascending: false });

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
    } else {
      setInvoices(invoicesData || []);
    }
    
    // 3. Fetch subscriptions for that client ID
    const { data: subscriptionsData, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select('id, stripe_price_id, status, current_period_end, cancel_at_period_end')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError);
    } else {
      setSubscriptions(subscriptionsData || []);
    }
    
    // 4. Fetch deposits for that client ID
    const { data: depositsData, error: depositsError } = await supabase
        .from('deposits')
        .select('id, amount_cents, status, applied_to_invoice_id, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
        
    if (depositsError) {
        console.error('Error fetching deposits:', depositsError);
    } else {
        setDeposits(depositsData || []);
    }
    
    // 5. Fetch billing products to map price IDs to names
    const { data: productsData } = await supabase
        .from('billing_products')
        .select('name, stripe_price_id');

    if (productsData) {
        setProducts(productsData as BillingProduct[]);
    }

    // 6. Fetch AI Voice usage (if workspace is configured)
    setVoiceLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: voiceRes, error: voiceErr } = await supabase.functions.invoke('get-retell-workspace-usage', {
        body: { client_id: clientId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!voiceErr) {
        const parsed = typeof voiceRes === 'string' ? JSON.parse(voiceRes) : voiceRes;
        if (parsed && !parsed.error) {
          setVoiceUsage(parsed as VoiceUsage);
          setBudgetInput(((parsed.budget_cents ?? 1000) / 100).toFixed(2));
        }
      }
    } catch {
      // Voice usage is optional — silently skip if unavailable
    } finally {
      setVoiceLoading(false);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (profile) {
      fetchBillingData();
    }
  }, [profile]);

  const handlePortalSession = async () => {
    if (!stripeCustomerId) {
        alert("Stripe customer record not found. Please contact support or wait for your first invoice.");
        return;
    }
    setIsProcessing(true);
    try {
      // We use the client ID here, but the edge function will look up the stripe_customer_id
      const { data: clientData } = await supabase.from('clients').select('id').eq('owner_profile_id', profile!.id).single();
      if (!clientData) throw new Error("Client ID not found for customer.");
      
      const result = await ClientBillingService.createPortalSession(clientData.id);
      window.open(result.portal_url, '_blank');
    } catch (e: any) {
      alert(`Failed to open portal: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCancelSubscription = (sub: Subscription) => {
      setCancellationTarget(sub);
      setCancellationSuccess(false);
      setIsCancelModalOpen(true);
  };
  
  const confirmCancellation = async () => {
      if (!cancellationTarget) return;
      setIsProcessing(true);
      
      try {
          const result = await ClientBillingService.cancelSubscription(cancellationTarget.id);
          
          setCancellationSuccess(true);
          setCancellationEffectiveDate(result.cancellation_effective_date);
          
          // Re-fetch data to update subscription status and client service status
          await fetchBillingData();
          
          // Keep modal open briefly to show success message
          setTimeout(() => {
              setIsCancelModalOpen(false);
              setCancellationTarget(null);
          }, 3000);
          
      } catch (e: any) {
          alert(`Cancellation failed: ${e.message}`);
          setCancellationSuccess(false);
          setIsCancelModalOpen(false);
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleDownloadInvoice = (pdfUrl: string) => {
      window.open(pdfUrl, '_blank');
  };

  const handleSaveBudget = async () => {
    setBudgetError(null);
    setBudgetSuccess(false);
    const dollars = parseFloat(budgetInput);
    if (isNaN(dollars) || dollars < 10) {
      setBudgetError('Minimum budget is $10.00');
      return;
    }
    const cents = Math.round(dollars * 100);
    setIsSavingBudget(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: res, error: fnErr } = await supabase.functions.invoke('set-voice-budget', {
        body: { budget_cents: cents },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (fnErr) throw new Error(fnErr.message);
      const parsed = typeof res === 'string' ? JSON.parse(res) : res;
      if (parsed?.error) throw new Error(parsed.error);
      setVoiceUsage(prev => prev ? { ...prev, budget_cents: cents } : prev);
      setBudgetSuccess(true);
      setTimeout(() => setBudgetSuccess(false), 3000);
    } catch (e: any) {
      setBudgetError(e.message || 'Failed to save budget.');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'active':
      case 'trialing': return 'bg-emerald-100 text-emerald-800';
      case 'open':
      case 'past_due':
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'draft': return 'bg-blue-100 text-blue-800';
      case 'canceled':
      case 'failed': return 'bg-red-100 text-red-800';
      case 'applied': return 'bg-purple-100 text-purple-800';
      case 'retracted': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };
  
  const getPlanName = (priceId: string) => {
      return products.find(p => p.stripe_price_id === priceId)?.name || 'Unknown Plan';
  };
  
  // Fully active subscription (first payment already processed)
  const activeSubscription = subscriptions.find(sub => sub.status === 'active' || sub.status === 'trialing');
  // Subscription awaiting first payment — admin created it but client hasn't paid yet
  const pendingSubscription = subscriptions.find(sub => sub.status === 'incomplete' || sub.status === 'past_due');
  // What to render in the subscription card (prefer active over pending)
  const displayedSubscription = activeSubscription || pendingSubscription;
  const isPaymentRequired = !activeSubscription && !!pendingSubscription;
  // The open invoice the client must pay to activate their pending subscription
  const pendingPaymentInvoice = isPaymentRequired
    ? invoices.find(inv => inv.status === 'open' || inv.status === 'draft')
    : null;

  const unappliedDeposits = deposits.filter(d => d.status === 'paid' && !d.applied_to_invoice_id);
  const totalUnappliedCredit = unappliedDeposits.reduce((sum, d) => sum + d.amount_cents, 0) / 100;

  if (isClientRecordMissing) {
      return (
          <ClientLayout>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                  <h1 className="text-3xl font-bold text-red-500">Client Record Missing</h1>
                  <p className="text-slate-500 mt-4">Your user account is not linked to a client business record. Please contact your administrator.</p>
              </div>
          </ClientLayout>
      );
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-purple-600" /> Billing & Payments
        </h1>

        {/* Service Status Banner (Non-blocking) */}
        <ServiceStatusBanner status={clientServiceStatus} type="client" />

        {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Subscription Status & Credit */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 h-fit">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Zap className="w-5 h-5 text-amber-600" /> Maintenance Plans
                        </h2>
                        
                        {displayedSubscription ? (
                            <div className={`space-y-3 mb-6 p-4 rounded-lg border ${isPaymentRequired ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                                {/* Payment required banner */}
                                {isPaymentRequired && (
                                    <div className="flex items-start gap-2 p-2 bg-amber-100 border border-amber-400 rounded-lg mb-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-amber-800">Payment Required to Activate</p>
                                            <p className="text-xs text-amber-700">Your plan is ready but needs first payment to start.</p>
                                        </div>
                                    </div>
                                )}

                                <p className="text-lg font-bold text-slate-900">{getPlanName(displayedSubscription.stripe_price_id)}</p>
                                <p className="text-sm text-slate-600 flex justify-between">
                                    <span>Status:</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isPaymentRequired ? 'bg-amber-200 text-amber-900' : getStatusColor(displayedSubscription.status)}`}>
                                        {isPaymentRequired ? 'Awaiting First Payment' : displayedSubscription.status}
                                    </span>
                                </p>
                                {activeSubscription && activeSubscription.current_period_end && (
                                    <p className="text-sm text-slate-600 flex justify-between">
                                        <span>Renews:</span>
                                        <span>{format(new Date(activeSubscription.current_period_end), 'MMM dd, yyyy')}</span>
                                    </p>
                                )}

                                {/* Pay now button for pending subscriptions */}
                                {isPaymentRequired && pendingPaymentInvoice?.hosted_invoice_url && (
                                    <a
                                        href={pendingPaymentInvoice.hosted_invoice_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2.5 mt-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CreditCard className="w-4 h-4" /> Pay Now &amp; Activate — ${(pendingPaymentInvoice.amount_due / 100).toFixed(2)}
                                    </a>
                                )}

                                {activeSubscription?.cancel_at_period_end ? (
                                    <div className="text-sm text-red-600 font-semibold pt-3 border-t border-slate-200 flex flex-col items-start gap-1">
                                        <div className="flex items-center gap-2">
                                            <X className="w-4 h-4" />
                                            <span>Cancellation Pending</span>
                                        </div>
                                        <span className="text-xs text-slate-500">Service ends: {cancellationEffectiveDate ? format(new Date(cancellationEffectiveDate), 'MMM dd, yyyy') : 'N/A'}</span>
                                    </div>
                                ) : activeSubscription && !isPaymentRequired ? (
                                    <button
                                        onClick={() => handleCancelSubscription(activeSubscription)}
                                        disabled={isProcessing}
                                        className="w-full py-2 mt-4 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                                    >
                                        Cancel Subscription
                                    </button>
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-slate-500 mb-6">No maintenance plan found. Contact your administrator to get started.</p>
                        )}

                        <p className="text-xs text-slate-500 mb-4">
                            Maintenance plans cover ongoing support, hosting, and updates. Billing status does not affect your access to this portal.
                        </p>

                      {activeSubscription ? (
  <button
    onClick={handlePortalSession}
    disabled={isProcessing || !stripeCustomerId}
    className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
  >
    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
    Manage Billing &amp; Plans
  </button>
) : isPaymentRequired ? (
  <div className="w-full py-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg font-semibold text-center text-sm">
    Billing portal available after first payment is completed
  </div>
) : (
  <div className="w-full py-3 bg-slate-100 text-slate-500 rounded-lg font-semibold text-center">
    <p className="text-sm">No active plan</p>
    <p className="text-xs mt-1">Billing portal available after first payment</p>
  </div>
)}
<p className="text-xs text-slate-500 mt-2 text-center">
  {activeSubscription ? '(Opens Stripe Customer Portal)' : ''}
</p>
                    </div>
                    
                    {/* Unapplied Credit */}
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <DollarSign className="w-5 h-5 text-emerald-600" /> Available Credit
                        </h2>
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-slate-600">Deposit Credit:</p>
                            <p className="text-2xl font-bold text-emerald-600">${totalUnappliedCredit.toFixed(2)}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            This credit will be automatically applied to your next project invoice.
                        </p>
                    </div>
                </div>

                {/* AI Voice Usage — shown only when workspace is configured */}
                {(voiceLoading || (voiceUsage && voiceUsage.voice_active)) && (
                  <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                      <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                        <Mic2 className="w-5 h-5 text-violet-600" /> AI Voice
                        <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide">Active</span>
                      </h2>
                      <p className="text-xs text-slate-500 mb-5 border-b border-slate-100 pb-4">Your AI voice call usage this month</p>

                      {voiceLoading ? (
                        <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading usage data...
                        </div>
                      ) : voiceUsage ? (() => {
                        const budget = voiceUsage.budget_cents;
                        // Estimated spend at $0.05/min
                        const estimatedCents = Math.round(voiceUsage.total_minutes * 5);
                        const usagePct = budget > 0 ? Math.min(estimatedCents / budget, 1) : 0;
                        const usagePctDisplay = Math.round(usagePct * 100);
                        const isNearLimit = usagePct >= 0.9;

                        return (
                          <div className="space-y-5">
                            {/* Stats row */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                                <p className="text-3xl font-bold text-slate-900">{voiceUsage.total_calls}</p>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Calls This Month</p>
                              </div>
                              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                                <p className="text-3xl font-bold text-slate-900">{voiceUsage.total_minutes}</p>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Minutes Used</p>
                              </div>
                              <div className="bg-violet-50 rounded-xl p-4 text-center border border-violet-100 col-span-2 md:col-span-1">
                                <p className="text-3xl font-bold text-violet-700">${(budget / 100).toFixed(2)}</p>
                                <p className="text-xs text-violet-500 mt-1 uppercase tracking-wide">Monthly Budget</p>
                              </div>
                            </div>

                            {/* Usage meter */}
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                                  <TrendingUp className="w-3.5 h-3.5" /> Usage
                                </span>
                                <span className={`text-xs font-bold ${isNearLimit ? 'text-amber-600' : 'text-slate-600'}`}>
                                  {usagePctDisplay}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-3 rounded-full transition-all duration-500 ${isNearLimit ? 'bg-amber-500' : 'bg-violet-500'}`}
                                  style={{ width: `${usagePctDisplay}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1">
                                Estimated usage based on call minutes · Budget resets monthly
                              </p>
                            </div>

                            {/* 90% alert */}
                            {isNearLimit && (
                              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-amber-800">
                                  You've used <strong>{usagePctDisplay}%</strong> of your monthly budget. Consider increasing your budget to avoid any service interruptions.
                                </p>
                              </div>
                            )}

                            {/* Budget control */}
                            <div className="border-t border-slate-100 pt-4">
                              <p className="text-sm font-semibold text-slate-700 mb-2">Adjust Monthly Budget</p>
                              <p className="text-xs text-slate-500 mb-3">Set the maximum you'd like to spend on AI voice calls each month. Minimum $10.00.</p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">$</span>
                                  <input
                                    type="number"
                                    min="10"
                                    step="5"
                                    value={budgetInput}
                                    onChange={e => { setBudgetInput(e.target.value); setBudgetError(null); }}
                                    className="w-36 pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  />
                                </div>
                                <button
                                  onClick={handleSaveBudget}
                                  disabled={isSavingBudget}
                                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                  {isSavingBudget ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                  Save Budget
                                </button>
                                {budgetSuccess && (
                                  <span className="text-sm text-emerald-600 flex items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-4 h-4" /> Saved!
                                  </span>
                                )}
                              </div>
                              {budgetError && (
                                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {budgetError}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })() : null}
                    </div>
                  </div>
                )}

                {/* Invoice List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-600" /> Project & Service Invoices
                        </h2>
                        <p className="text-sm text-slate-600 mb-4">
                            Invoices reflect services provided or in progress, including project milestones and one-time fees.
                        </p>

                        {invoices.length === 0 ? (
                            <div className="text-center p-8 bg-slate-50 rounded-lg">
                                <p className="text-slate-500">No invoices found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {invoices.map((invoice) => (
                                            <tr key={invoice.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{format(new Date(invoice.created_at), 'MMM dd, yyyy')}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${(invoice.amount_due / 100).toFixed(2)} USD</td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                                                        {invoice.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {invoice.status.toLowerCase() === 'paid' && invoice.pdf_url ? (
                                                        <button 
                                                            onClick={() => handleDownloadInvoice(invoice.pdf_url!)}
                                                            className="flex items-center justify-end gap-1 text-emerald-600 hover:text-emerald-800"
                                                        >
                                                            Download PDF <Download className="w-4 h-4" />
                                                        </button>
                                                    ) : invoice.hosted_invoice_url ? (
                                                        <a 
                                                            href={invoice.hosted_invoice_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className={`flex items-center justify-end gap-1 text-indigo-600 hover:text-indigo-900`}
                                                        >
                                                            View/Pay <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-400">N/A</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    
                    {/* Deposit History List */}
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-blue-600" /> Deposit Payments
                        </h2>
                        <p className="text-sm text-slate-600 mb-4">
                            Deposits are upfront payments that are applied as credit to future project invoices.
                        </p>

                        {deposits.length === 0 ? (
                            <div className="text-center p-8 bg-slate-50 rounded-lg">
                                <p className="text-slate-500">No deposit payments found.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {deposits.map((deposit) => (
                                    <div key={deposit.id} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <span className="font-medium text-slate-900">${(deposit.amount_cents / 100).toFixed(2)} USD</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(deposit.status)}`}>
                                            {deposit.status}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${deposit.applied_to_invoice_id ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {deposit.applied_to_invoice_id ? 'Applied' : 'Unapplied Credit'}
                                        </span>
                                        <span className="text-xs text-slate-500">{format(new Date(deposit.created_at), 'MMM dd, yyyy')}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
      
      {/* Cancellation Modal */}
      {cancellationTarget && (
          <CancelSubscriptionModal
              isOpen={isCancelModalOpen}
              onClose={() => setIsCancelModalOpen(false)}
              onConfirm={confirmCancellation}
              planName={getPlanName(cancellationTarget.stripe_price_id)}
              isProcessing={isProcessing}
              cancellationSuccess={cancellationSuccess}
          />
      )}
    </ClientLayout>
  );
};

export default ClientBilling;
