"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../hooks/useAuth';
import AiContentGenerator from '../components/AiContentGenerator';
import {
  Loader2, Save, Send, ArrowUp, ArrowDown, Trash2,
  Plus, Eye, X, AlertCircle, CheckCircle2, Package,
  Zap, Clock, ChevronDown, ChevronUp, FileText,
} from 'lucide-react';
import { ClientProposal, ClientProposalItem } from '../types/proposals';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '$0.00';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function BillingTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const map: Record<string, string> = {
    one_time: 'bg-slate-100 text-slate-600',
    subscription: 'bg-blue-100 text-blue-700',
    yearly: 'bg-violet-100 text-violet-700',
    setup_plus_subscription: 'bg-indigo-100 text-indigo-700',
  };
  const labels: Record<string, string> = {
    one_time: 'One-Time',
    subscription: 'Monthly',
    yearly: 'Yearly',
    setup_plus_subscription: 'Setup + Monthly',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${map[type] || 'bg-slate-100 text-slate-600'}`}>
      {labels[type] || type}
    </span>
  );
}

function StatusBadge({ status }: { status: ClientProposal['status'] }) {
  const map: Record<ClientProposal['status'], string> = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-700',
    revised: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Types for catalog items ──────────────────────────────────────────────────

interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  billing_type: string;
  amount_cents: number | null;
  monthly_price_cents: number | null;
  setup_fee_cents: number | null;
  active: boolean;
}

interface AddonCatalog {
  id: string;
  name: string;
  description: string | null;
  billing_type: string;
  price_cents: number | null;
  monthly_price_cents: number | null;
  setup_fee_cents: number | null;
  is_active: boolean;
}

interface Client {
  id: string;
  business_name: string;
  billing_email: string | null;
}

// A draft item (before saving) may not have a DB id
interface DraftItem extends Omit<ClientProposalItem, 'id' | 'proposal_id' | 'created_at'> {
  _localId: string; // temp key for react list rendering
  id?: string;
}

let _localIdCounter = 0;
function nextLocalId() {
  return `local_${++_localIdCounter}`;
}

function itemFromProduct(p: BillingProduct): DraftItem {
  return {
    _localId: nextLocalId(),
    item_type: 'billing_product',
    source_id: p.id,
    name: p.name,
    description: p.description || '',
    billing_type: p.billing_type,
    amount_cents: p.amount_cents,
    monthly_price_cents: p.monthly_price_cents,
    setup_fee_cents: p.setup_fee_cents,
    sort_order: 0,
  };
}

function itemFromAddon(a: AddonCatalog): DraftItem {
  return {
    _localId: nextLocalId(),
    item_type: 'addon',
    source_id: a.id,
    name: a.name,
    description: a.description || '',
    billing_type: a.billing_type,
    amount_cents: a.price_cents,
    monthly_price_cents: a.monthly_price_cents,
    setup_fee_cents: a.setup_fee_cents,
    sort_order: 0,
  };
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ title, clientMessage, items, onClose }: {
  title: string;
  clientMessage: string;
  items: DraftItem[];
  onClose: () => void;
}) {
  const oneTime = items.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const setup = items.reduce((s, i) => s + (i.setup_fee_cents || 0), 0);
  const monthly = items.reduce((s, i) => s + (i.monthly_price_cents || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <span className="font-bold text-slate-800">Client Preview</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-8 space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">{title || 'Your Service Proposal'}</h2>
          {clientMessage && (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-slate-700 text-sm italic">
              {clientMessage}
            </div>
          )}
          <div className="space-y-4">
            {items.map(item => (
              <div key={item._localId} className="p-5 border border-slate-200 rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-slate-900 text-lg">{item.name}</h3>
                  <BillingTypeBadge type={item.billing_type} />
                </div>
                {item.description && (
                  <p className="mt-2 text-slate-600 text-sm whitespace-pre-line">{item.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {item.amount_cents != null && item.amount_cents > 0 && (
                    <span className="font-semibold text-slate-800">{formatCents(item.amount_cents)} one-time</span>
                  )}
                  {item.setup_fee_cents != null && item.setup_fee_cents > 0 && (
                    <span className="font-semibold text-slate-800">{formatCents(item.setup_fee_cents)} setup fee</span>
                  )}
                  {item.monthly_price_cents != null && item.monthly_price_cents > 0 && (
                    <span className="font-semibold text-slate-800">{formatCents(item.monthly_price_cents)}/mo</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h3 className="font-bold text-slate-800 mb-3">Pricing Summary</h3>
            {oneTime > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">One-Time Charges</span><span className="font-semibold">{formatCents(oneTime)}</span></div>}
            {setup > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Setup Fees</span><span className="font-semibold">{formatCents(setup)}</span></div>}
            {monthly > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Monthly Recurring</span><span className="font-semibold">{formatCents(monthly)}/mo</span></div>}
            <div className="border-t border-slate-300 pt-2 flex justify-between font-bold">
              <span>Total Due Today</span>
              <span>{formatCents(oneTime + setup + (monthly > 0 ? monthly : 0))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminProposalBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isEditMode = Boolean(id);

  // ── Loading / Error ──
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Proposal header state ──
  const [clientId, setClientId] = useState('');
  const [proposalTitle, setProposalTitle] = useState('Your Service Proposal');
  const [clientMessage, setClientMessage] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [currentStatus, setCurrentStatus] = useState<ClientProposal['status']>('draft');
  const [clientResponse, setClientResponse] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [declinedAt, setDeclinedAt] = useState<string | null>(null);

  // ── Catalog state ──
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [addons, setAddons] = useState<AddonCatalog[]>([]);
  const [catalogTab, setCatalogTab] = useState<'products' | 'addons'>('products');

  // ── Proposal items ──
  const [items, setItems] = useState<DraftItem[]>([]);

  // ── UI state ──
  const [showPreview, setShowPreview] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', billing_type: 'one_time', amount_cents: '', monthly_price_cents: '', setup_fee_cents: '', description: '' });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // ─── Load catalog ──────────────────────────────────────────────────────────

  const fetchCatalog = useCallback(async () => {
    const [{ data: pData }, { data: aData }, { data: cData }] = await Promise.all([
      supabase.from('billing_products').select('id, name, description, billing_type, amount_cents, monthly_price_cents, setup_fee_cents, active').eq('active', true).order('name'),
      supabase.from('addon_catalog').select('id, name, description, billing_type, price_cents, monthly_price_cents, setup_fee_cents, is_active').eq('is_active', true).order('name'),
      supabase.from('clients').select('id, business_name, billing_email').order('business_name'),
    ]);
    setProducts((pData as BillingProduct[]) || []);
    setAddons((aData as AddonCatalog[]) || []);
    setClients((cData as Client[]) || []);
  }, []);

  // ─── Load existing proposal (edit mode) ───────────────────────────────────

  const fetchProposal = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const { data: proposal, error: pErr } = await supabase
      .from('client_proposals')
      .select('*, clients(business_name, billing_email)')
      .eq('id', id)
      .single();

    if (pErr || !proposal) {
      setError('Proposal not found.');
      setIsLoading(false);
      return;
    }

    setClientId(proposal.client_id);
    setProposalTitle(proposal.title);
    setClientMessage(proposal.client_message || '');
    setAdminNotes(proposal.notes || '');
    setCurrentStatus(proposal.status as ClientProposal['status']);
    setClientResponse(proposal.client_response);
    setApprovedAt(proposal.approved_at);
    setDeclinedAt(proposal.declined_at);

    const { data: itemData } = await supabase
      .from('client_proposal_items')
      .select('*')
      .eq('proposal_id', id)
      .order('sort_order');

    const draftItems: DraftItem[] = (itemData || []).map((i: ClientProposalItem) => ({
      ...i,
      _localId: i.id,
    }));
    setItems(draftItems);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchCatalog();
    if (isEditMode) fetchProposal();
  }, [fetchCatalog, fetchProposal, isEditMode]);

  // ─── Item helpers ─────────────────────────────────────────────────────────

  const addItem = (item: DraftItem) => {
    setItems(prev => [...prev, { ...item, sort_order: prev.length }]);
  };

  const removeItem = (localId: string) => {
    setItems(prev => prev.filter(i => i._localId !== localId));
  };

  const moveItem = (localId: string, dir: -1 | 1) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i._localId === localId);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((it, si) => ({ ...it, sort_order: si }));
    });
  };

  const updateItem = (localId: string, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map(i => i._localId === localId ? { ...i, ...patch } : i));
  };

  const toggleExpanded = (localId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(localId) ? next.delete(localId) : next.add(localId);
      return next;
    });
  };

  // ─── Save helpers ─────────────────────────────────────────────────────────

  const upsertProposal = async (status: ClientProposal['status']): Promise<string | null> => {
    if (!clientId) { setError('Please select a client.'); return null; }
    if (items.length === 0) { setError('Please add at least one item to the proposal.'); return null; }

    setError(null);
    setIsSaving(true);

    const now = new Date().toISOString();
    const proposalPayload: Record<string, unknown> = {
      client_id: clientId,
      created_by: profile?.id || null,
      title: proposalTitle || 'Your Service Proposal',
      status,
      notes: adminNotes || null,
      client_message: clientMessage || null,
      updated_at: now,
      ...(status === 'sent' ? { sent_at: now } : {}),
    };

    let proposalId = id;

    if (isEditMode && proposalId) {
      const { error: updateErr } = await supabase
        .from('client_proposals')
        .update(proposalPayload)
        .eq('id', proposalId);
      if (updateErr) { setError(updateErr.message); setIsSaving(false); return null; }
    } else {
      const { data: newProposal, error: insertErr } = await supabase
        .from('client_proposals')
        .insert(proposalPayload)
        .select('id')
        .single();
      if (insertErr || !newProposal) { setError(insertErr?.message || 'Failed to create proposal.'); setIsSaving(false); return null; }
      proposalId = newProposal.id;
    }

    // Replace all items
    if (proposalId) {
      await supabase.from('client_proposal_items').delete().eq('proposal_id', proposalId);
      const itemsPayload = items.map((item, idx) => ({
        proposal_id: proposalId,
        item_type: item.item_type,
        source_id: item.source_id || null,
        name: item.name,
        description: item.description || null,
        billing_type: item.billing_type || null,
        amount_cents: item.amount_cents || null,
        monthly_price_cents: item.monthly_price_cents || null,
        setup_fee_cents: item.setup_fee_cents || null,
        sort_order: idx,
      }));
      const { error: itemsErr } = await supabase.from('client_proposal_items').insert(itemsPayload);
      if (itemsErr) { setError(itemsErr.message); setIsSaving(false); return null; }
    }

    setIsSaving(false);
    return proposalId || null;
  };

  const handleSaveDraft = async () => {
    const savedId = await upsertProposal('draft');
    if (savedId) {
      setSuccessMsg('Draft saved.');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (!isEditMode) navigate(`/admin/proposals/${savedId}`);
    }
  };

  const handleSend = async () => {
    const savedId = await upsertProposal('sent');
    if (savedId) {
      // Send email notification via edge function
      const client = clients.find(c => c.id === clientId);
      if (client?.billing_email) {
        try {
          await supabase.functions.invoke('send-proposal-email', {
            body: {
              proposalId: savedId,
              clientEmail: client.billing_email,
              clientName: client.business_name,
              proposalTitle: proposalTitle || 'Your Service Proposal',
              adminMessage: clientMessage || '',
            },
          });
        } catch (e) {
          console.warn('[AdminProposalBuilder] Email send failed (non-fatal):', e);
        }
      }
      setSuccessMsg('Proposal sent to client!');
      setTimeout(() => setSuccessMsg(null), 4000);
      setCurrentStatus('sent');
      if (!isEditMode) navigate(`/admin/proposals/${savedId}`);
    }
  };

  // ─── Pricing summary ──────────────────────────────────────────────────────

  const oneTimeTotal = items.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const setupTotal = items.reduce((s, i) => s + (i.setup_fee_cents || 0), 0);
  const monthlyTotal = items.reduce((s, i) => s + (i.monthly_price_cents || 0), 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      </AdminLayout>
    );
  }

  const isReadOnly = currentStatus === 'approved' || currentStatus === 'declined';

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              {isEditMode ? 'Edit Proposal' : 'New Proposal'}
            </h1>
            {isEditMode && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-500">Status:</span>
                <StatusBadge status={currentStatus} />
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to Client
                </button>
              </>
            )}
            {isReadOnly && currentStatus === 'approved' && (
              <button
                type="button"
                onClick={() => navigate(`/admin/clients/${clientId}?tab=billing`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <FileText className="w-4 h-4" /> Create Invoice
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {successMsg}
          </div>
        )}

        {/* Approved / Declined Response */}
        {isReadOnly && clientResponse && (
          <div className={`mb-6 p-4 rounded-xl border ${currentStatus === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className="font-semibold text-sm mb-1">
              {currentStatus === 'approved' ? `✅ Approved on ${approvedAt ? new Date(approvedAt).toLocaleDateString() : '—'}` : `❌ Declined on ${declinedAt ? new Date(declinedAt).toLocaleDateString() : '—'}`}
            </p>
            {clientResponse && <p className="text-sm text-slate-700 italic">"{clientResponse}"</p>}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Config panel ── */}
          <div className="space-y-5">

            {/* Step 1: Client & Header */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Step 1 — Client & Header</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Client *</label>
                  <select
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                  >
                    <option value="">— Select Client —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.business_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Proposal Title</label>
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={e => setProposalTitle(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Message to Client</label>
                  <textarea
                    value={clientMessage}
                    onChange={e => setClientMessage(e.target.value)}
                    rows={3}
                    disabled={isReadOnly}
                    placeholder="Hi! Here's a proposal based on our discovery call…"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Internal Notes (not shown to client)</label>
                  <textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    rows={2}
                    disabled={isReadOnly}
                    placeholder="Notes for your reference…"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none bg-amber-50 border-amber-200 disabled:opacity-70"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Catalog */}
            {!isReadOnly && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Step 2 — Add Services</h2>

                {/* Catalog Tabs */}
                <div className="flex border border-slate-200 rounded-lg overflow-hidden mb-4">
                  <button
                    type="button"
                    onClick={() => setCatalogTab('products')}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${catalogTab === 'products' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Core Services
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogTab('addons')}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${catalogTab === 'addons' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Add-ons
                  </button>
                </div>

                {/* Catalog Items */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {catalogTab === 'products' && products.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <BillingTypeBadge type={p.billing_type} />
                          <span className="text-xs text-slate-500">
                            {p.amount_cents ? formatCents(p.amount_cents) : ''}
                            {p.monthly_price_cents ? `${formatCents(p.monthly_price_cents)}/mo` : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addItem(itemFromProduct(p))}
                        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  ))}
                  {catalogTab === 'addons' && addons.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <BillingTypeBadge type={a.billing_type} />
                          <span className="text-xs text-slate-500">
                            {a.price_cents ? formatCents(a.price_cents) : ''}
                            {a.monthly_price_cents ? `${formatCents(a.monthly_price_cents)}/mo` : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addItem(itemFromAddon(a))}
                        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  ))}
                  {catalogTab === 'products' && products.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No active products.</p>
                  )}
                  {catalogTab === 'addons' && addons.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No active add-ons.</p>
                  )}
                </div>

                {/* Custom Item */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCustomForm(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Custom Item
                  </button>
                  {showCustomForm && (
                    <div className="mt-3 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        placeholder="Item name *"
                        value={customItem.name}
                        onChange={e => setCustomItem(p => ({ ...p, name: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded text-xs"
                      />
                      <select
                        value={customItem.billing_type}
                        onChange={e => setCustomItem(p => ({ ...p, billing_type: e.target.value }))}
                        className="w-full p-2 border border-slate-300 rounded text-xs"
                      >
                        <option value="one_time">One-Time</option>
                        <option value="subscription">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="setup_plus_subscription">Setup + Monthly</option>
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" placeholder="One-time $" value={customItem.amount_cents} onChange={e => setCustomItem(p => ({ ...p, amount_cents: e.target.value }))} className="p-2 border border-slate-300 rounded text-xs" />
                        <input type="number" placeholder="Setup $" value={customItem.setup_fee_cents} onChange={e => setCustomItem(p => ({ ...p, setup_fee_cents: e.target.value }))} className="p-2 border border-slate-300 rounded text-xs" />
                        <input type="number" placeholder="Monthly $" value={customItem.monthly_price_cents} onChange={e => setCustomItem(p => ({ ...p, monthly_price_cents: e.target.value }))} className="p-2 border border-slate-300 rounded text-xs" />
                      </div>
                      <textarea
                        placeholder="Description (optional)"
                        value={customItem.description}
                        onChange={e => setCustomItem(p => ({ ...p, description: e.target.value }))}
                        rows={2}
                        className="w-full p-2 border border-slate-300 rounded text-xs resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!customItem.name.trim()) return;
                            addItem({
                              _localId: nextLocalId(),
                              item_type: 'billing_product',
                              source_id: null,
                              name: customItem.name,
                              description: customItem.description || null,
                              billing_type: customItem.billing_type,
                              amount_cents: customItem.amount_cents ? Math.round(parseFloat(customItem.amount_cents) * 100) : null,
                              monthly_price_cents: customItem.monthly_price_cents ? Math.round(parseFloat(customItem.monthly_price_cents) * 100) : null,
                              setup_fee_cents: customItem.setup_fee_cents ? Math.round(parseFloat(customItem.setup_fee_cents) * 100) : null,
                              sort_order: items.length,
                            });
                            setCustomItem({ name: '', billing_type: 'one_time', amount_cents: '', monthly_price_cents: '', setup_fee_cents: '', description: '' });
                            setShowCustomForm(false);
                          }}
                          className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition-colors"
                        >
                          Add to Proposal
                        </button>
                        <button type="button" onClick={() => setShowCustomForm(false)} className="px-3 py-1.5 border border-slate-200 text-xs rounded hover:bg-slate-100 transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Proposal Items ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Items list */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                Proposal Items ({items.length})
              </h2>

              {items.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No items yet. Add services from the catalog.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const isExpanded = expandedItems.has(item._localId);
                    return (
                      <div key={item._localId} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Item Header */}
                        <div
                          className="flex items-center gap-3 p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => toggleExpanded(item._localId)}
                        >
                          <div className="flex flex-col gap-1">
                            {!isReadOnly && (
                              <>
                                <button type="button" onClick={e => { e.stopPropagation(); moveItem(item._localId, -1); }} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button type="button" onClick={e => { e.stopPropagation(); moveItem(item._localId, 1); }} disabled={idx === items.length - 1} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">{item.name}</span>
                              <BillingTypeBadge type={item.billing_type} />
                            </div>
                            <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                              {item.amount_cents != null && item.amount_cents > 0 && <span>{formatCents(item.amount_cents)} one-time</span>}
                              {item.setup_fee_cents != null && item.setup_fee_cents > 0 && <span>{formatCents(item.setup_fee_cents)} setup</span>}
                              {item.monthly_price_cents != null && item.monthly_price_cents > 0 && <span>{formatCents(item.monthly_price_cents)}/mo</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isReadOnly && (
                              <button type="button" onClick={e => { e.stopPropagation(); removeItem(item._localId); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>

                        {/* Expanded edit area */}
                        {isExpanded && (
                          <div className="p-4 space-y-3 border-t border-slate-200">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={e => updateItem(item._localId, { name: e.target.value })}
                                disabled={isReadOnly}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Billing Type</label>
                              <select
                                value={item.billing_type || 'one_time'}
                                onChange={e => updateItem(item._localId, { billing_type: e.target.value })}
                                disabled={isReadOnly}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                              >
                                <option value="one_time">One-Time</option>
                                <option value="subscription">Monthly</option>
                                <option value="yearly">Yearly</option>
                                <option value="setup_plus_subscription">Setup + Monthly</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">One-Time ($)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.amount_cents != null ? (item.amount_cents / 100).toFixed(2) : ''}
                                  onChange={e => updateItem(item._localId, { amount_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                                  disabled={isReadOnly}
                                  className="w-full p-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Setup Fee ($)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.setup_fee_cents != null ? (item.setup_fee_cents / 100).toFixed(2) : ''}
                                  onChange={e => updateItem(item._localId, { setup_fee_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                                  disabled={isReadOnly}
                                  className="w-full p-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Monthly ($)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.monthly_price_cents != null ? (item.monthly_price_cents / 100).toFixed(2) : ''}
                                  onChange={e => updateItem(item._localId, { monthly_price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                                  disabled={isReadOnly}
                                  className="w-full p-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-semibold text-slate-600">Description</label>
                                {!isReadOnly && (
                                  <AiContentGenerator
                                    entityType="service_proposal_item"
                                    entityName={item.name}
                                    initialContent={item.description || ''}
                                    onGenerate={(desc) => updateItem(item._localId, { description: desc })}
                                    pricingType={item.billing_type || undefined}
                                    price={item.amount_cents ? item.amount_cents / 100 : item.monthly_price_cents ? item.monthly_price_cents / 100 : undefined}
                                    keyFeatures={item.name}
                                  />
                                )}
                              </div>
                              <textarea
                                value={item.description || ''}
                                onChange={e => updateItem(item._localId, { description: e.target.value })}
                                rows={4}
                                disabled={isReadOnly}
                                placeholder="Describe what this service includes…"
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none disabled:bg-slate-50"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Pricing Summary</h2>
              <div className="space-y-2">
                {oneTimeTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> One-Time Charges</span>
                    <span className="font-semibold">{formatCents(oneTimeTotal)}</span>
                  </div>
                )}
                {setupTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Setup Fees</span>
                    <span className="font-semibold">{formatCents(setupTotal)}</span>
                  </div>
                )}
                {monthlyTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Monthly Recurring</span>
                    <span className="font-semibold">{formatCents(monthlyTotal)}/mo</span>
                  </div>
                )}
                {(oneTimeTotal + setupTotal + monthlyTotal) === 0 && (
                  <p className="text-slate-400 text-xs">Add items to see pricing.</p>
                )}
                {(oneTimeTotal + setupTotal + monthlyTotal) > 0 && (
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-slate-900">
                    <span>Total Due Today</span>
                    <span>{formatCents(oneTimeTotal + setupTotal + (monthlyTotal > 0 ? monthlyTotal : 0))}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPreview && (
        <PreviewModal
          title={proposalTitle}
          clientMessage={clientMessage}
          items={items}
          onClose={() => setShowPreview(false)}
        />
      )}
    </AdminLayout>
  );
};

export default AdminProposalBuilder;
