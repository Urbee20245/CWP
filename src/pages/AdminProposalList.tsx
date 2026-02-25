"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Loader2, FilePlus2, ChevronRight, Filter, XCircle, Trash2 } from 'lucide-react';
import { ClientProposal } from '../types/proposals';

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'approved', 'declined', 'revised', 'retracted'] as const;

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: ClientProposal['status'] }) {
  const map: Record<ClientProposal['status'], string> = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-700',
    revised: 'bg-amber-100 text-amber-700',
    retracted: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

const RETRACTABLE_STATUSES = ['draft', 'sent', 'approved'];

const AdminProposalList: React.FC = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<ClientProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Retract state
  const [retractConfirmId, setRetractConfirmId] = useState<string | null>(null);
  const [retractReason, setRetractReason] = useState('');
  const [isRetracting, setIsRetracting] = useState(false);
  const [retractToast, setRetractToast] = useState<string | null>(null);

  // Delete state (retracted proposals only)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProposals = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('client_proposals')
      .select('*, clients(business_name, billing_email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminProposalList] fetch error:', error);
    } else {
      setProposals((data as ClientProposal[]) || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleRetractProposal = async (proposalId: string) => {
    setIsRetracting(true);
    const { error } = await supabase
      .from('client_proposals')
      .update({
        status: 'retracted',
        retracted_at: new Date().toISOString(),
        retracted_reason: retractReason || null,
      })
      .eq('id', proposalId);

    if (!error) {
      setRetractToast('Proposal retracted successfully');
      setTimeout(() => setRetractToast(null), 4000);
      setRetractConfirmId(null);
      setRetractReason('');
      fetchProposals();
    } else {
      console.error('[AdminProposalList] retract error:', error);
      alert('Failed to retract proposal. Please try again.');
    }
    setIsRetracting(false);
  };

  const handleDeleteProposal = async (proposalId: string) => {
    setIsDeleting(true);
    const { error } = await supabase.from('client_proposals').delete().eq('id', proposalId);
    if (!error) {
      setRetractToast('Proposal deleted successfully');
      setTimeout(() => setRetractToast(null), 4000);
      setDeleteConfirmId(null);
      fetchProposals();
    } else {
      console.error('[AdminProposalList] delete error:', error);
      alert('Failed to delete proposal. Please try again.');
    }
    setIsDeleting(false);
  };

  const filtered = statusFilter === 'all'
    ? proposals
    : proposals.filter(p => p.status === statusFilter);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FilePlus2 className="w-6 h-6 text-indigo-600" />
              Client Proposals
            </h1>
            <p className="text-sm text-slate-500 mt-1">Create and manage service proposals for clients.</p>
          </div>
          <button
            onClick={() => navigate('/admin/proposals/new')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <FilePlus2 className="w-4 h-4" />
            New Proposal
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500 font-medium">Filter:</span>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Retract toast */}
        {retractToast && (
          <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            {retractToast}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <FilePlus2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No proposals found</p>
            <p className="text-sm text-slate-400 mt-1">
              {statusFilter !== 'all' ? 'Try changing the filter.' : 'Create your first proposal to get started.'}
            </p>
            {statusFilter === 'all' && (
              <button
                onClick={() => navigate('/admin/proposals/new')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Proposal
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Created</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Sent</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(proposal => (
                  <React.Fragment key={proposal.id}>
                    <tr
                      onClick={() => navigate(`/admin/proposals/${proposal.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {proposal.clients?.business_name || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700">{proposal.title}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={proposal.status} />
                      </td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(proposal.created_at)}</td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(proposal.sent_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {RETRACTABLE_STATUSES.includes(proposal.status) && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setRetractConfirmId(proposal.id);
                                setRetractReason('');
                              }}
                              title="Retract proposal"
                              className="text-rose-400 hover:text-rose-600 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {proposal.status === 'retracted' && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setDeleteConfirmId(proposal.id);
                              }}
                              title="Delete retracted proposal"
                              className="text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </td>
                    </tr>
                    {retractConfirmId === proposal.id && (
                      <tr>
                        <td colSpan={6} className="px-5 py-4 bg-rose-50 border-b border-rose-100">
                          <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-slate-800">Are you sure you want to retract this proposal?</p>
                            <input
                              type="text"
                              value={retractReason}
                              onChange={e => setRetractReason(e.target.value)}
                              placeholder="Reason (optional)"
                              className="w-full max-w-md p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-rose-400"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRetractProposal(proposal.id)}
                                disabled={isRetracting}
                                className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isRetracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                Confirm Retract
                              </button>
                              <button
                                onClick={() => setRetractConfirmId(null)}
                                className="px-4 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {deleteConfirmId === proposal.id && (
                      <tr>
                        <td colSpan={6} className="px-5 py-4 bg-red-50 border-b border-red-100">
                          <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-slate-800">Permanently delete this retracted proposal? This cannot be undone.</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDeleteProposal(proposal.id)}
                                disabled={isDeleting}
                                className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Confirm Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminProposalList;
