"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import AdminLayout from '../components/AdminLayout';
import {
  Loader2, ChevronDown, ChevronUp, ExternalLink, Copy, Check,
  Sparkles, RefreshCw, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingSession {
  id: string;
  session_token: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  business_type: string | null;
  phone: string | null;
  email: string | null;
  business_description: string | null;
  selected_products: any[] | null;
  selected_addons: any[] | null;
  estimated_one_time_cents: number | null;
  estimated_monthly_cents: number | null;
  status: string | null;
  proposal_id: string | null;
  created_at: string;
}

interface BillingProduct {
  id: string;
  name: string;
  description: string;
  onboarding_description: string | null;
  billing_type: string;
  amount_cents: number | null;
  setup_fee_cents: number | null;
  monthly_price_cents: number | null;
  active: boolean;
  show_in_onboarding: boolean;
  onboarding_category: string | null;
  onboarding_type: 'core' | 'addon' | 'hidden' | null;
}

interface Addon {
  id: string;
  name: string;
  description: string;
  price_cents: number | null;
  setup_fee_cents: number | null;
  monthly_price_cents: number | null;
  billing_type: string;
  is_active: boolean;
  show_in_onboarding: boolean;
  onboarding_category: string | null;
  onboarding_type: 'core' | 'addon' | 'hidden' | null;
}

type OnboardingType = 'core' | 'addon' | 'hidden';

interface ClientProposal {
  id: string;
  title: string;
  status: string;
  created_at: string;
  clients?: { business_name: string; billing_email: string | null };
}

type Tab = 'submissions' | 'products' | 'addons';
type StatusOption = 'in_progress' | 'proposal_submitted' | 'converted';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress',
  proposal_submitted: 'Proposal Submitted',
  converted: 'Converted',
};

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-yellow-100 text-yellow-800',
  proposal_submitted: 'bg-blue-100 text-blue-800',
  converted: 'bg-green-100 text-green-800',
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({
  message, type, onClose,
}) => (
  <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-medium ${
    type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
  }`}>
    {message}
    <button onClick={onClose}><X className="w-4 h-4" /></button>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminOnboardingManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('submissions');

  // Submissions
  const [sessions, setSessions] = useState<OnboardingSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // Products
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Addons
  const [addons, setAddons] = useState<Addon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);

  // Revoke link
  const [proposals, setProposals] = useState<ClientProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Inline edit
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productEdits, setProductEdits] = useState<Partial<BillingProduct>>({});
  const [editingAddon, setEditingAddon] = useState<string | null>(null);
  const [addonEdits, setAddonEdits] = useState<Partial<Addon>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetching ──────────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    const { data, error } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setSessions(data as OnboardingSession[]);
    setSessionsLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    const { data, error } = await supabase
      .from('billing_products')
      .select('*')
      .order('name');
    if (!error && data) setProducts(data as BillingProduct[]);
    setProductsLoading(false);
  }, []);

  const fetchAddons = useCallback(async () => {
    setAddonsLoading(true);
    const { data, error } = await supabase
      .from('addon_catalog')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data) setAddons(data as Addon[]);
    setAddonsLoading(false);
  }, []);

  const fetchProposals = useCallback(async () => {
    setProposalsLoading(true);
    const { data, error } = await supabase
      .from('client_proposals')
      .select('id, title, status, created_at, clients(business_name, billing_email)')
      .in('status', ['sent', 'draft'])
      .order('created_at', { ascending: false });
    if (!error && data) setProposals(data as ClientProposal[]);
    setProposalsLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchProposals();
  }, [fetchSessions, fetchProposals]);

  useEffect(() => {
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'addons') fetchAddons();
  }, [activeTab, fetchProducts, fetchAddons]);

  // ── Status update ─────────────────────────────────────────────────────────

  const updateStatus = async (id: string, status: StatusOption) => {
    setStatusUpdating(id);
    const { error } = await supabase
      .from('onboarding_sessions')
      .update({ status })
      .eq('id', id);
    if (!error) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      showToast('Status updated.');
    } else {
      showToast('Failed to update status.', 'error');
    }
    setStatusUpdating(null);
  };

  // ── Product toggle + save ─────────────────────────────────────────────────

  const toggleProductOnboarding = async (p: BillingProduct) => {
    const { error } = await supabase
      .from('billing_products')
      .update({ show_in_onboarding: !p.show_in_onboarding })
      .eq('id', p.id);
    if (!error) {
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, show_in_onboarding: !x.show_in_onboarding } : x));
    } else {
      showToast('Update failed.', 'error');
    }
  };

  const saveProductEdits = async (id: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from('billing_products')
      .update(productEdits)
      .eq('id', id);
    if (!error) {
      setProducts(prev => prev.map(x => x.id === id ? { ...x, ...productEdits } : x));
      setEditingProduct(null);
      setProductEdits({});
      showToast('Product saved.');
    } else {
      showToast('Save failed.', 'error');
    }
    setSavingId(null);
  };

  // ── Addon toggle + save ───────────────────────────────────────────────────

  const toggleAddonOnboarding = async (a: Addon) => {
    const { error } = await supabase
      .from('addon_catalog')
      .update({ show_in_onboarding: !a.show_in_onboarding })
      .eq('id', a.id);
    if (!error) {
      setAddons(prev => prev.map(x => x.id === a.id ? { ...x, show_in_onboarding: !x.show_in_onboarding } : x));
    } else {
      showToast('Update failed.', 'error');
    }
  };

  const saveAddonEdits = async (id: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from('addon_catalog')
      .update(addonEdits)
      .eq('id', id);
    if (!error) {
      setAddons(prev => prev.map(x => x.id === id ? { ...x, ...addonEdits } : x));
      setEditingAddon(null);
      setAddonEdits({});
      showToast('Add-on saved.');
    } else {
      showToast('Save failed.', 'error');
    }
    setSavingId(null);
  };

  // ── Onboarding type selectors ─────────────────────────────────────────────

  const setProductOnboardingType = async (p: BillingProduct, type: OnboardingType) => {
    const updates = {
      onboarding_type: type,
      show_in_onboarding: type !== 'hidden',
    };
    const { error } = await supabase
      .from('billing_products')
      .update(updates)
      .eq('id', p.id);
    if (!error) {
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...updates } : x));
      showToast('Saved!');
    } else {
      showToast('Update failed.', 'error');
    }
  };

  const setAddonOnboardingType = async (a: Addon, type: OnboardingType) => {
    const updates = {
      onboarding_type: type,
      show_in_onboarding: type !== 'hidden',
    };
    const { error } = await supabase
      .from('addon_catalog')
      .update(updates)
      .eq('id', a.id);
    if (!error) {
      setAddons(prev => prev.map(x => x.id === a.id ? { ...x, ...updates } : x));
      showToast('Saved!');
    } else {
      showToast('Update failed.', 'error');
    }
  };

  // ── Revoke & issue Gem link ───────────────────────────────────────────────

  const revokeAndIssueLink = async (proposal: ClientProposal) => {
    setRevokingId(proposal.id);
    try {
      // 1. Mark proposal as revoked
      const { error: revokeError } = await supabase
        .from('client_proposals')
        .update({ status: 'revoked' })
        .eq('id', proposal.id);
      if (revokeError) throw revokeError;

      // 2. Create new onboarding session pre-filled with client info
      const token = generateToken();
      const clientName = (proposal.clients?.business_name || proposal.title || '').split(' ');
      const { error: sessionError } = await supabase
        .from('onboarding_sessions')
        .insert({
          session_token: token,
          business_name: proposal.clients?.business_name || null,
          email: proposal.clients?.billing_email || null,
          status: 'in_progress',
          proposal_id: proposal.id,
        });
      if (sessionError) throw sessionError;

      // 3. Build shareable link
      const link = `${window.location.origin}/onboarding?session=${token}`;
      setGeneratedLinks(prev => ({ ...prev, [proposal.id]: link }));

      // Update local proposal list
      setProposals(prev => prev.filter(p => p.id !== proposal.id));
      await fetchSessions();
      showToast('Gem link generated!');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate link.', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  const copyLink = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="p-6 max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Gem Onboarding</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">
            Manage AI-guided onboarding submissions, product visibility, and add-on settings.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {(['submissions', 'products', 'addons'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'products' ? 'Services' : tab === 'addons' ? 'Add-ons' : 'Submissions'}
            </button>
          ))}
        </div>

        {/* ── Submissions tab ───────────────────────────────────────────────── */}

        {activeTab === 'submissions' && (
          <div className="space-y-6">
            {/* Revoke & issue Gem links section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-indigo-500" />
                Revoke Proposal & Issue Gem Link
              </h2>
              <p className="text-slate-500 text-xs mb-4">
                Revoke an existing proposal and send the client back through Gem to build a new one.
              </p>

              {proposalsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                </div>
              ) : proposals.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No active proposals to revoke.</p>
              ) : (
                <div className="space-y-3">
                  {proposals.map(p => (
                    <div key={p.id} className="flex flex-col gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{p.title}</p>
                          {p.clients?.business_name && (
                            <p className="text-xs text-slate-500">{p.clients.business_name}</p>
                          )}
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        <button
                          onClick={() => revokeAndIssueLink(p)}
                          disabled={revokingId === p.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60 flex-shrink-0"
                        >
                          {revokingId === p.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RefreshCw className="w-3.5 h-3.5" />}
                          Revoke & Issue Gem Link
                        </button>
                      </div>

                      {generatedLinks[p.id] && (
                        <div className="flex items-center gap-2 mt-1 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                          <code className="flex-1 text-xs text-indigo-700 truncate">
                            {generatedLinks[p.id]}
                          </code>
                          <button
                            onClick={() => copyLink(p.id, generatedLinks[p.id])}
                            className="p-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                          >
                            {copiedLink === p.id
                              ? <Check className="w-4 h-4 text-green-600" />
                              : <Copy className="w-4 h-4 text-indigo-500" />}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sessions list */}
            <div className="bg-white rounded-2xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800">
                  All Submissions
                  <span className="ml-2 text-slate-400 font-normal text-sm">({sessions.length})</span>
                </h2>
                <button
                  onClick={fetchSessions}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {sessionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-slate-400 py-12 text-sm">No submissions yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sessions.map(s => {
                    const isExpanded = expandedSession === s.id;
                    const statusKey = (s.status || 'in_progress') as StatusOption;
                    return (
                      <div key={s.id}>
                        <div
                          className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">
                              {s.first_name} {s.last_name}
                              {s.business_name && (
                                <span className="text-slate-400 font-normal ml-2">· {s.business_name}</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(s.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                              {s.email && <span className="ml-2">· {s.email}</span>}
                            </p>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                            STATUS_COLORS[statusKey] || 'bg-slate-100 text-slate-600'
                          }`}>
                            {STATUS_LABELS[statusKey] || statusKey}
                          </span>

                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                        </div>

                        {isExpanded && (
                          <div className="px-6 pb-6 bg-slate-50 border-t border-slate-100">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mb-4">
                              {[
                                ['First Name', s.first_name],
                                ['Last Name', s.last_name],
                                ['Business', s.business_name],
                                ['Industry', s.business_type],
                                ['Phone', s.phone],
                                ['Email', s.email],
                              ].map(([label, val]) => (
                                <div key={label as string}>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                                  <p className="text-sm text-slate-800 mt-0.5">{val || '—'}</p>
                                </div>
                              ))}
                              <div className="sm:col-span-2">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Business Description</p>
                                <p className="text-sm text-slate-800 mt-0.5 leading-relaxed">{s.business_description || '—'}</p>
                              </div>
                            </div>

                            {/* Selected items */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Core Services</p>
                                {Array.isArray(s.selected_products) && s.selected_products.length > 0 ? (
                                  <ul className="space-y-1">
                                    {s.selected_products.map((p: any, i: number) => (
                                      <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                                        {p.name}
                                      </li>
                                    ))}
                                  </ul>
                                ) : <p className="text-sm text-slate-400">None selected</p>}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Add-ons</p>
                                {Array.isArray(s.selected_addons) && s.selected_addons.length > 0 ? (
                                  <ul className="space-y-1">
                                    {s.selected_addons.map((a: any, i: number) => (
                                      <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                                        {a.name}
                                      </li>
                                    ))}
                                  </ul>
                                ) : <p className="text-sm text-slate-400">None selected</p>}
                              </div>
                            </div>

                            {/* Totals */}
                            <div className="flex gap-6 mb-4 p-3 rounded-xl bg-white border border-slate-200">
                              <div>
                                <p className="text-xs text-slate-400">Est. One-Time</p>
                                <p className="text-sm font-bold text-slate-800">{formatCents(s.estimated_one_time_cents)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400">Est. Monthly</p>
                                <p className="text-sm font-bold text-slate-800">{formatCents(s.estimated_monthly_cents)}/mo</p>
                              </div>
                            </div>

                            {/* Status control */}
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-semibold text-slate-500">Change Status:</p>
                              <select
                                value={s.status || 'in_progress'}
                                onChange={e => updateStatus(s.id, e.target.value as StatusOption)}
                                disabled={statusUpdating === s.id}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              >
                                <option value="in_progress">In Progress</option>
                                <option value="proposal_submitted">Proposal Submitted</option>
                                <option value="converted">Converted</option>
                              </select>
                              {statusUpdating === s.id && (
                                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Core Products tab ─────────────────────────────────────────────── */}

        {activeTab === 'products' && (
          <div className="bg-white rounded-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Services</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Set how each billing product appears in the Gem onboarding flow. "Core Service" shows in Step 1, "Add-on" shows in Step 2, "Hidden" removes it from onboarding.
              </p>
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {products.map(p => {
                  const isEditing = editingProduct === p.id;
                  const currentType: OnboardingType = (p.onboarding_type as OnboardingType) || 'hidden';
                  return (
                    <div key={p.id} className="px-6 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Name</label>
                                  <input
                                    type="text"
                                    value={productEdits.name ?? p.name}
                                    onChange={e => setProductEdits(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Onboarding Category</label>
                                  <input
                                    type="text"
                                    value={productEdits.onboarding_category ?? (p.onboarding_category || '')}
                                    onChange={e => setProductEdits(prev => ({ ...prev, onboarding_category: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    placeholder="e.g. Website, Marketing..."
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">One-Time / Setup (cents)</label>
                                  <input
                                    type="number"
                                    value={productEdits.amount_cents ?? (p.amount_cents || '')}
                                    onChange={e => setProductEdits(prev => ({ ...prev, amount_cents: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Monthly Price (cents)</label>
                                  <input
                                    type="number"
                                    value={productEdits.monthly_price_cents ?? (p.monthly_price_cents || '')}
                                    onChange={e => setProductEdits(prev => ({ ...prev, monthly_price_cents: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Gem Description</label>
                                  <textarea
                                    rows={3}
                                    value={productEdits.onboarding_description ?? (p.onboarding_description || '')}
                                    onChange={e => setProductEdits(prev => ({ ...prev, onboarding_description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                    placeholder="Short description shown to clients in Gem..."
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveProductEdits(p.id)}
                                  disabled={savingId === p.id}
                                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center gap-1.5"
                                >
                                  {savingId === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  Save
                                </button>
                                <button
                                  onClick={() => { setEditingProduct(null); setProductEdits({}); }}
                                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-3 flex-wrap mb-2">
                                <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                                {/* Status badge */}
                                {currentType === 'core' && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                                    Core Service
                                  </span>
                                )}
                                {currentType === 'addon' && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
                                    Add-on
                                  </span>
                                )}
                                {currentType === 'hidden' && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">
                                    Hidden
                                  </span>
                                )}
                                {p.onboarding_category && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-xs">
                                    {p.onboarding_category}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mb-2 leading-relaxed line-clamp-2">
                                {p.onboarding_description || p.description || '—'}
                              </p>
                              <div className="flex gap-4 mb-3 text-xs text-slate-500">
                                {p.billing_type === 'yearly' && p.amount_cents && (
                                  <span>{formatCents(p.amount_cents)}/yr</span>
                                )}
                                {p.billing_type === 'subscription' && p.monthly_price_cents && (
                                  <span>{formatCents(p.monthly_price_cents)}/mo</span>
                                )}
                                {p.billing_type === 'one_time' && (p.amount_cents || p.setup_fee_cents) && (
                                  <span>{formatCents(p.amount_cents || p.setup_fee_cents)} one-time</span>
                                )}
                                {p.billing_type === 'setup_plus_subscription' && (
                                  <>
                                    {p.setup_fee_cents && <span>{formatCents(p.setup_fee_cents)} setup</span>}
                                    {p.monthly_price_cents && <span>+ {formatCents(p.monthly_price_cents)}/mo</span>}
                                  </>
                                )}
                              </div>
                              {/* 3-way pill selector */}
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setProductOnboardingType(p, 'core')}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                    currentType === 'core'
                                      ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                  }`}
                                >
                                  Core Service
                                </button>
                                <button
                                  onClick={() => setProductOnboardingType(p, 'addon')}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                    currentType === 'addon'
                                      ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300 hover:text-purple-600'
                                  }`}
                                >
                                  Add-on
                                </button>
                                <button
                                  onClick={() => setProductOnboardingType(p, 'hidden')}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                    currentType === 'hidden'
                                      ? 'bg-slate-500 text-white border-slate-500 shadow-sm'
                                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  Hidden
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <button
                            onClick={() => {
                              setEditingProduct(p.id);
                              setProductEdits({});
                            }}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50 transition-all"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Add-ons tab ───────────────────────────────────────────────────── */}

        {activeTab === 'addons' && (
          <div className="bg-white rounded-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Add-ons</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Set how each add-on appears in the Gem onboarding flow. "Core Service" moves it to Step 1, "Add-on" keeps it in Step 2, "Hidden" removes it from onboarding.
              </p>
            </div>

            {addonsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {addons.map(a => {
                  const isEditing = editingAddon === a.id;
                  const currentType: OnboardingType = (a.onboarding_type as OnboardingType) || 'hidden';
                  return (
                    <div key={a.id} className="px-6 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Name</label>
                                  <input
                                    type="text"
                                    value={addonEdits.name ?? a.name}
                                    onChange={e => setAddonEdits(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Onboarding Category</label>
                                  <input
                                    type="text"
                                    value={addonEdits.onboarding_category ?? (a.onboarding_category || '')}
                                    onChange={e => setAddonEdits(prev => ({ ...prev, onboarding_category: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    placeholder="e.g. Marketing, AI Tools..."
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Setup Fee (cents)</label>
                                  <input
                                    type="number"
                                    value={addonEdits.setup_fee_cents ?? (a.setup_fee_cents || '')}
                                    onChange={e => setAddonEdits(prev => ({ ...prev, setup_fee_cents: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Monthly Price (cents)</label>
                                  <input
                                    type="number"
                                    value={addonEdits.monthly_price_cents ?? (a.monthly_price_cents || '')}
                                    onChange={e => setAddonEdits(prev => ({ ...prev, monthly_price_cents: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">One-Time Price (cents)</label>
                                  <input
                                    type="number"
                                    value={addonEdits.price_cents ?? (a.price_cents || '')}
                                    onChange={e => setAddonEdits(prev => ({ ...prev, price_cents: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">Description</label>
                                  <textarea
                                    rows={3}
                                    value={addonEdits.description ?? a.description}
                                    onChange={e => setAddonEdits(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveAddonEdits(a.id)}
                                  disabled={savingId === a.id}
                                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center gap-1.5"
                                >
                                  {savingId === a.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  Save
                                </button>
                                <button
                                  onClick={() => { setEditingAddon(null); setAddonEdits({}); }}
                                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-3 flex-wrap mb-2">
                                <p className="font-semibold text-slate-800 text-sm">{a.name}</p>
                                {/* Status badge */}
                                {currentType === 'core' && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                                    Core Service
                                  </span>
                                )}
                                {currentType === 'addon' && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
                                    Add-on
                                  </span>
                                )}
                                {currentType === 'hidden' && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">
                                    Hidden
                                  </span>
                                )}
                                {a.onboarding_category && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-xs">
                                    {a.onboarding_category}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mb-2 leading-relaxed line-clamp-2">
                                {a.description || '—'}
                              </p>
                              <div className="flex gap-4 mb-3 text-xs text-slate-500">
                                {a.setup_fee_cents && <span>{formatCents(a.setup_fee_cents)} setup</span>}
                                {a.monthly_price_cents && <span>{formatCents(a.monthly_price_cents)}/mo</span>}
                                {a.billing_type === 'one_time' && a.price_cents && (
                                  <span>{formatCents(a.price_cents)} one-time</span>
                                )}
                              </div>
                              {/* 3-way pill selector */}
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setAddonOnboardingType(a, 'core')}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                    currentType === 'core'
                                      ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                  }`}
                                >
                                  Core Service
                                </button>
                                <button
                                  onClick={() => setAddonOnboardingType(a, 'addon')}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                    currentType === 'addon'
                                      ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300 hover:text-purple-600'
                                  }`}
                                >
                                  Add-on
                                </button>
                                <button
                                  onClick={() => setAddonOnboardingType(a, 'hidden')}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                    currentType === 'hidden'
                                      ? 'bg-slate-500 text-white border-slate-500 shadow-sm'
                                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  Hidden
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <button
                            onClick={() => {
                              setEditingAddon(a.id);
                              setAddonEdits({});
                            }}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50 transition-all"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminOnboardingManager;
