"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Loader2, DollarSign, FileText, ExternalLink } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';

interface Invoice {
  id: string;
  amount: number;
  status: string;
  hosted_invoice_url: string;
  created_at: string;
}

const ClientBilling: React.FC = () => {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBillingData = async () => {
      if (!profile) return;
      setIsLoading(true);

      // 1. Find the client record associated with the user's profile ID
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_profile_id', profile.id)
        .single();

      if (clientError || !clientData) {
        console.error('Error fetching client record:', clientError);
        setIsLoading(false);
        return;
      }
      
      const clientId = clientData.id;

      // 2. Fetch invoices for that client ID
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, amount, status, hosted_invoice_url, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
      } else {
        setInvoices(invoicesData || []);
      }

      setIsLoading(false);
    };

    if (profile) {
      fetchBillingData();
    }
  }, [profile]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'bg-emerald-100 text-emerald-800';
      case 'open': return 'bg-amber-100 text-amber-800';
      case 'draft': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-purple-600" /> Billing & Payments
        </h1>

        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">
            Your Invoices
          </h2>

          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : invoices.length === 0 ? (
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
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${(invoice.amount / 100).toFixed(2)} USD</td>
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
                            className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end gap-1"
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
      </div>
    </ClientLayout>
  );
};

export default ClientBilling;