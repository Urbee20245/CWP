"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Loader2, DollarSign, FileText, ExternalLink, Zap, CreditCard } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import { ClientBillingService } from '../services/clientBillingService';

interface Invoice {
  id: string;
  amount_due: number;
  status: string;
  hosted_invoice_url: string;
  created_at: string;
}

interface Subscription {
  id: string;
  stripe_price_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
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
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);

  const fetchBillingData = async () => {
    if (!profile) return;
    setIsLoading(true);

    // 1. Find the client record associated with the user's profile ID
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, stripe_customer_id')
      .eq('owner_profile_id', profile.id)
      .single();

    if (clientError || !clientData) {
      console.error('Error fetching client record:', clientError);
      setIsLoading(false);
      return;
    }
    
    const clientId = clientData.id;
    setStripeCustomerId(clientData.stripe_customer_id);

    // 2. Fetch invoices for that client ID
    const { data: invoicesData, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, amount_due, status, hosted_invoice_url, created_at')
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
      .select('id, stripe_price_id, status, current_period_end, cancel_at_period_end')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError);
    } else {
      setSubscriptions(subscriptionsData || []);
    }
    
    // 4. Fetch billing products to map price IDs to names
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
        alert("Stripe customer record not found. Please contact support.");
        return;
    }
    setIsProcessing(true);
    try {
      // We use the client ID here, but the edge function will look up the stripe_customer_id
      const { data: clientData } = await supabase.from('clients').select('id').eq('stripe_customer_id', stripeCustomerId).single();
      if (!clientData) throw new Error("Client ID not found for customer.");
      
      const result = await ClientBillingService.createPortalSession(clientData.id);
      window.open(result.portal_url, '_blank');
    } catch (e: any) {
      alert(`Failed to open portal: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'active':
      case 'trialing': return 'bg-emerald-100 text-emerald-800';
      case 'open':
      case 'past_due': return 'bg-amber-100 text-amber-800';
      case 'draft': return 'bg-blue-100 text-blue-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };
  
  const getPlanName = (priceId: string) => {
      return products.find(p => p.stripe_price_id === priceId)?.name || 'Unknown Plan';
  };
  
  const activeSubscription = subscriptions.find(sub => sub.status === 'active' || sub.status === 'trialing');

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-purple-600" /> Billing & Payments
        </h1>

        {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Subscription Status */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-lg border border-slate-100 p-6 h-fit">
                    <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Zap className="w-5 h-5 text-amber-600" /> Subscription Status
                    </h2>
                    
                    {activeSubscription ? (
                        <div className="space-y-3 mb-6">
                            <p className="text-lg font-bold text-slate-900">{getPlanName(activeSubscription.stripe_price_id)}</p>
                            <p className="text-sm text-slate-600 flex justify-between">
                                <span>Status:</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(activeSubscription.status)}`}>
                                    {activeSubscription.status}
                                </span>
                            </p>
                            <p className="text-sm text-slate-600 flex justify-between">
                                <span>Renews:</span>
                                <span>{new Date(activeSubscription.current_period_end).toLocaleDateString()}</span>
                            </p>
                        </div>
                    ) : (
                        <p className="text-slate-500 mb-6">You do not have an active subscription.</p>
                    )}

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

                {/* Invoice List */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                    <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-600" /> Invoice History
                    </h2>

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
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{new Date(invoice.created_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${(invoice.amount_due / 100).toFixed(2)} USD</td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                                                    {invoice.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {invoice.hosted_invoice_url ? (
                                                    <a 
                                                        href={invoice.hosted_invoice_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className={`flex items-center justify-end gap-1 ${invoice.status.toLowerCase() === 'paid' ? 'text-emerald-600' : 'text-indigo-600 hover:text-indigo-900'}`}
                                                    >
                                                        {invoice.status.toLowerCase() === 'paid' ? 'View Receipt' : 'View/Pay'} <ExternalLink className="w-4 h-4" />
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
            </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientBilling;