"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Loader2, DollarSign, FileText, ExternalLink, Zap, CreditCard, CheckCircle2, AlertTriangle, Download, X } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import { ClientBillingService } from '../services/clientBillingService';
import ServiceStatusBanner from '../components/ServiceStatusBanner';
import CancelSubscriptionModal from '../components/CancelSubscriptionModal'; // New Import
import { format } from 'date-fns';

interface Invoice {
  id: string;
  amount_due: number;
  status: string;
  hosted_invoice_url: string;
  pdf_url: string | null; // Added pdf_url
  created_at: string;
}

interface Subscription {
  id: string;
  stripe_price_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean; // Added cancel_at_period_end
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
  
  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationTarget, setCancellationTarget] = useState<Subscription | null>(null);
  const [cancellationSuccess, setCancellationSuccess] = useState(false);


  const fetchBillingData = async () => {
    if (!profile) return;
    setIsLoading(true);

    // 1. Find the client record associated with the user's profile ID
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, stripe_customer_id, service_status')
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
    setStripeCustomerId(clientData.stripe_customer_id);
    setClientServiceStatus(clientData.service_status as any);
    setIsClientRecordMissing(false);

    // 2. Fetch invoices for that client ID
    const { data: invoicesData, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, amount_due, status, hosted_invoice_url, pdf_url, created_at') // Added pdf_url
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
    } else {
      setInvoices(invoicesData || []);
    }
    
    // 3. Fetch subscriptions for that client ID
    const { data: subscriptionsData, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select('id, stripe_price_id, status, current_period_end, cancel_at_period_end') // Added cancel_at_period_end
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
          await ClientBillingService.cancelSubscription(cancellationTarget.id);
          setCancellationSuccess(true);
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
      default: return 'bg-slate-100 text-slate-800';
    }
  };
  
  const getPlanName = (priceId: string) => {
      return products.find(p => p.stripe_price_id === priceId)?.name || 'Unknown Plan';
  };
  
  const activeSubscription = subscriptions.find(sub => sub.status === 'active' || sub.status === 'trialing');
  
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
                        
                        {activeSubscription ? (
                            <div className="space-y-3 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <p className="text-lg font-bold text-slate-900">{getPlanName(activeSubscription.stripe_price_id)}</p>
                                <p className="text-sm text-slate-600 flex justify-between">
                                    <span>Status:</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(activeSubscription.status)}`}>
                                        {activeSubscription.status}
                                    </span>
                                </p>
                                <p className="text-sm text-slate-600 flex justify-between">
                                    <span>Renews:</span>
                                    <span>{format(new Date(activeSubscription.current_period_end), 'MMM dd, yyyy')}</span>
                                </p>
                                
                                {activeSubscription.cancel_at_period_end ? (
                                    <div className="text-sm text-red-600 font-semibold pt-3 border-t border-slate-200 flex items-center gap-2">
                                        <X className="w-4 h-4" /> Cancellation Pending
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleCancelSubscription(activeSubscription)}
                                        disabled={isProcessing}
                                        className="w-full py-2 mt-4 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                                    >
                                        Cancel Subscription
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-slate-500 mb-6">No active maintenance plan found.</p>
                        )}
                        
                        <p className="text-xs text-slate-500 mb-4">
                            Maintenance plans cover ongoing support, hosting, and updates. Billing status does not affect your access to this portal.
                        </p>

                        <button 
                            onClick={handlePortalSession}
                            disabled={isProcessing || !stripeCustomerId}
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            Manage Billing & Plans
                        </button>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                            (Opens Stripe Customer Portal)
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