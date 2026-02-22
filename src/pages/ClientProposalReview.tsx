"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ClientLayout from '../components/ClientLayout';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../hooks/useAuth';
import { Loader2, CheckCircle2, MessageCircle, ChevronRight, FileCheck, AlertCircle } from 'lucide-react';
import { ClientProposal, ClientProposalItem } from '../types/proposals';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '$0.00';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function BillingTypeLabel({ type }: { type: string | null }) {
  const labels: Record<string, string> = {
    one_time: 'One-Time',
    subscription: 'Monthly',
    yearly: 'Yearly',
    setup_plus_subscription: 'Setup + Monthly',
  };
  const colors: Record<string, string> = {
    one_time: 'bg-slate-100 text-slate-700',
    subscription: 'bg-blue-100 text-blue-700',
    yearly: 'bg-violet-100 text-violet-700',
    setup_plus_subscription: 'bg-indigo-100 text-indigo-700',
  };
  if (!type) return null;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[type] || 'bg-slate-100 text-slate-700'}`}>
      {labels[type] || type}
    </span>
  );
}

// ─── Proposal List View ───────────────────────────────────────────────────────

const ProposalListView: React.FC<{ proposals: ClientProposal[]; onSelect: (id: string) => void }> = ({ proposals, onSelect }) => {
  const statusColors: Record<ClientProposal['status'], string> = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-700',
    revised: 'bg-amber-100 text-amber-700',
    retracted: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
        <FileCheck className="w-6 h-6 text-indigo-600" /> My Proposals
      </h1>
      <p className="text-slate-500 text-sm mb-8">Review and respond to service proposals from your team.</p>

      {proposals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No proposals yet</p>
          <p className="text-sm text-slate-400 mt-1">Your team will send a proposal here when it's ready.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{p.title}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Sent {formatDate(p.sent_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[p.status]}`}>
                    {p.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Proposal Detail View ─────────────────────────────────────────────────────

const ProposalDetailView: React.FC<{
  proposal: ClientProposal;
  items: ClientProposalItem[];
  onRespond: (status: 'approved' | 'declined', response: string) => Promise<void>;
  isResponding: boolean;
  responded: boolean;
  onBack: () => void;
}> = ({ proposal, items, onRespond, isResponding, responded, onBack }) => {
  const [declineMode, setDeclineMode] = useState(false);
  const [responseText, setResponseText] = useState('');

  const oneTimeTotal = items.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const setupTotal = items.reduce((s, i) => s + (i.setup_fee_cents || 0), 0);
  const monthlyTotal = items.reduce((s, i) => s + (i.monthly_price_cents || 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Back nav */}
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mb-6 font-medium transition-colors">
        ← Back to Proposals
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{proposal.title}</h1>
        <p className="text-slate-500 text-sm mt-1">Prepared for you on {formatDate(proposal.sent_at)}</p>
      </div>

      {/* Client message */}
      {proposal.client_message && (
        <div className="mb-8 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
          <p className="text-sm font-semibold text-indigo-700 mb-1">A note from your team:</p>
          <p className="text-slate-700 italic whitespace-pre-line">{proposal.client_message}</p>
        </div>
      )}

      {/* Service Items */}
      <div className="space-y-5 mb-8">
        {items.map(item => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-xl font-bold text-slate-900">{item.name}</h2>
              <BillingTypeLabel type={item.billing_type} />
            </div>

            {item.description && (
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line mb-4">{item.description}</p>
            )}

            {/* Price breakdown */}
            <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100">
              {item.amount_cents != null && item.amount_cents > 0 && (
                <div className="text-sm">
                  <span className="text-slate-500">One-Time:</span>{' '}
                  <span className="font-bold text-slate-900">{formatCents(item.amount_cents)}</span>
                </div>
              )}
              {item.setup_fee_cents != null && item.setup_fee_cents > 0 && (
                <div className="text-sm">
                  <span className="text-slate-500">Setup Fee:</span>{' '}
                  <span className="font-bold text-slate-900">{formatCents(item.setup_fee_cents)}</span>
                </div>
              )}
              {item.monthly_price_cents != null && item.monthly_price_cents > 0 && (
                <div className="text-sm">
                  <span className="text-slate-500">Monthly:</span>{' '}
                  <span className="font-bold text-slate-900">{formatCents(item.monthly_price_cents)}/mo</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pricing Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8">
        <h3 className="font-bold text-slate-800 mb-4 text-lg">Pricing Summary</h3>
        <div className="space-y-2">
          {oneTimeTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">One-Time Charges</span>
              <span className="font-semibold text-slate-900">{formatCents(oneTimeTotal)}</span>
            </div>
          )}
          {setupTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Setup Fees</span>
              <span className="font-semibold text-slate-900">{formatCents(setupTotal)}</span>
            </div>
          )}
          {monthlyTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Monthly Recurring</span>
              <span className="font-semibold text-slate-900">{formatCents(monthlyTotal)}/mo</span>
            </div>
          )}
          <div className="border-t border-slate-300 pt-3 flex justify-between">
            <span className="font-bold text-slate-900">Total Due Today</span>
            <span className="font-bold text-slate-900 text-lg">{formatCents(oneTimeTotal + setupTotal + (monthlyTotal > 0 ? monthlyTotal : 0))}</span>
          </div>
        </div>
      </div>

      {/* Response area */}
      {responded ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-bold text-emerald-800 text-lg mb-1">Thank you! We've received your response.</h3>
          <p className="text-emerald-700 text-sm">Your team has been notified and will follow up with you shortly.</p>
        </div>
      ) : proposal.status === 'sent' ? (
        <div className="space-y-4">
          {!declineMode ? (
            <>
              <button
                onClick={() => onRespond('approved', '')}
                disabled={isResponding}
                className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-2xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
              >
                {isResponding ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                Yes, this is what I want — Approve Proposal
              </button>
              <button
                onClick={() => setDeclineMode(true)}
                disabled={isResponding}
                className="w-full py-3 border border-slate-300 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                I have questions / Decline
              </button>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Share your questions or concerns</h3>
                <button onClick={() => setDeclineMode(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
              <textarea
                value={responseText}
                onChange={e => setResponseText(e.target.value)}
                rows={4}
                placeholder="Tell us what questions you have or what you'd like changed…"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
              />
              <button
                onClick={() => onRespond('declined', responseText)}
                disabled={isResponding}
                className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isResponding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                Send Response
              </button>
            </div>
          )}
        </div>
      ) : proposal.status === 'approved' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-bold text-emerald-800 text-lg">Proposal Approved</h3>
          <p className="text-emerald-700 text-sm mt-1">Approved on {formatDate(proposal.approved_at)}</p>
          {proposal.client_response && (
            <p className="text-slate-600 text-sm mt-3 italic">"{proposal.client_response}"</p>
          )}
        </div>
      ) : proposal.status === 'declined' ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <MessageCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-bold text-amber-800 text-lg">You've indicated you have questions</h3>
          <p className="text-amber-700 text-sm mt-1">We'll follow up with you shortly.</p>
          {proposal.client_response && (
            <p className="text-slate-600 text-sm mt-3 italic">"{proposal.client_response}"</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ClientProposalReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ClientProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<ClientProposal | null>(null);
  const [proposalItems, setProposalItems] = useState<ClientProposalItem[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [responded, setResponded] = useState(false);

  // Load client_id for this user
  const [clientId, setClientId] = useState<string | null>(null);

  const fetchClientId = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_profile_id', profile.id)
      .single();
    if (data) setClientId(data.id);
  }, [profile?.id]);

  const fetchProposals = useCallback(async (cId: string) => {
    const { data, error: err } = await supabase
      .from('client_proposals')
      .select('*, clients(business_name, billing_email)')
      .eq('client_id', cId)
      .neq('status', 'draft')
      .neq('status', 'retracted')
      .order('created_at', { ascending: false });

    if (err) {
      setError('Failed to load proposals.');
    } else {
      setProposals((data as ClientProposal[]) || []);
    }
    setIsLoading(false);
  }, []);

  const fetchProposalDetail = useCallback(async (proposalId: string) => {
    setIsLoading(true);
    const [{ data: pData, error: pErr }, { data: iData }] = await Promise.all([
      supabase.from('client_proposals').select('*, clients(business_name, billing_email)').eq('id', proposalId).single(),
      supabase.from('client_proposal_items').select('*').eq('proposal_id', proposalId).order('sort_order'),
    ]);

    if (pErr || !pData) {
      setError('Proposal not found.');
    } else {
      setSelectedProposal(pData as ClientProposal);
      setProposalItems((iData as ClientProposalItem[]) || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchClientId();
  }, [fetchClientId]);

  useEffect(() => {
    if (!clientId) return;
    if (id) {
      fetchProposalDetail(id);
    } else {
      fetchProposals(clientId);
    }
  }, [clientId, id, fetchProposalDetail, fetchProposals]);

  const handleSelectProposal = (proposalId: string) => {
    navigate(`/client/proposals/${proposalId}`);
  };

  const handleBack = () => {
    navigate('/client/proposals');
  };

  const handleRespond = async (status: 'approved' | 'declined', responseText: string) => {
    if (!selectedProposal) return;
    setIsResponding(true);

    const patch: Record<string, unknown> = {
      status,
      client_response: responseText || null,
      updated_at: new Date().toISOString(),
    };
    if (status === 'approved') patch.approved_at = new Date().toISOString();
    if (status === 'declined') patch.declined_at = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('client_proposals')
      .update(patch)
      .eq('id', selectedProposal.id)
      .eq('status', 'sent'); // RLS-safe guard

    if (updateErr) {
      setError('Failed to save your response. Please try again.');
    } else {
      setResponded(true);
      setSelectedProposal(prev => prev ? { ...prev, status, client_response: responseText } : prev);
    }
    setIsResponding(false);
  };

  return (
    <ClientLayout>
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">{error}</p>
          <button onClick={handleBack} className="mt-4 text-sm text-indigo-600 hover:underline">← Back</button>
        </div>
      ) : id && selectedProposal ? (
        <ProposalDetailView
          proposal={selectedProposal}
          items={proposalItems}
          onRespond={handleRespond}
          isResponding={isResponding}
          responded={responded}
          onBack={handleBack}
        />
      ) : (
        <ProposalListView proposals={proposals} onSelect={handleSelectProposal} />
      )}
    </ClientLayout>
  );
};

export default ClientProposalReview;
