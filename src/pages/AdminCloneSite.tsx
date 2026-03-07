"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  Copy, Loader2, CheckCircle, AlertTriangle, Plus, Trash2,
  Edit3, Save, X, ExternalLink, Upload, ChevronRight, Info,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StaticSite {
  client_id: string;
  client_slug: string | null;
  business_name: string;
  phone: string | null;
  primary_color: string | null;
  email: string | null;
  is_template: boolean;
  template_name: string | null;
  clients: { business_name: string; phone: string | null } | null;
}

interface TargetClient {
  id: string;
  business_name: string;
  phone: string | null;
}

interface TargetBrief {
  client_id: string;
  client_slug: string | null;
  business_name: string;
  phone: string | null;
  primary_color: string | null;
  email: string | null;
}

interface ReplacementRow {
  id: number;
  label: string;
  oldValue: string;
  newValue: string;
  type: 'text' | 'color';
}

type Tab = 'templates' | 'clone';
type CloneStep = 1 | 2 | 3 | 4;

// ─── Helpers ────────────────────────────────────────────────────────────────

function stepLabel(step: CloneStep): string {
  switch (step) {
    case 1: return 'Source Template';
    case 2: return 'Target Client';
    case 3: return 'Brand Replacements';
    case 4: return 'Review & Clone';
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminCloneSite() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('clone');

  // ── Template Management State ──────────────────────────────────────────
  const [allStaticSites, setAllStaticSites] = useState<StaticSite[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showAllSites, setShowAllSites] = useState(false);
  const [editingTemplateName, setEditingTemplateName] = useState<Record<string, string>>({});
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);

  // ── Clone Flow State ───────────────────────────────────────────────────
  const [step, setStep] = useState<CloneStep>(1);
  const [sourceClientId, setSourceClientId] = useState('');
  const [sourceSite, setSourceSite] = useState<StaticSite | null>(null);
  const [targetClientId, setTargetClientId] = useState('');
  const [targetClients, setTargetClients] = useState<TargetClient[]>([]);
  const [targetBrief, setTargetBrief] = useState<TargetBrief | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [replacements, setReplacements] = useState<ReplacementRow[]>([]);
  const [nextRowId, setNextRowId] = useState(100);
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<{
    success: boolean;
    message: string;
    target_slug?: string;
    copied_count?: number;
    failed_count?: number;
  } | null>(null);

  // ── Load Static Sites ──────────────────────────────────────────────────
  const loadStaticSites = useCallback(async () => {
    setLoadingTemplates(true);
    const { data } = await supabase
      .from('website_briefs')
      .select('client_id, client_slug, business_name, phone, primary_color, email, is_template, template_name, clients(business_name, phone)')
      .eq('site_type', 'static')
      .order('business_name');
    setAllStaticSites((data as StaticSite[]) || []);
    setLoadingTemplates(false);
  }, []);

  // ── Load Target Clients ────────────────────────────────────────────────
  const loadTargetClients = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, business_name, phone')
      .eq('status', 'active')
      .order('business_name');
    setTargetClients((data as TargetClient[]) || []);
  }, []);

  useEffect(() => {
    loadStaticSites();
    loadTargetClients();
  }, [loadStaticSites, loadTargetClients]);

  // ── When source changes, update sourceSite ─────────────────────────────
  useEffect(() => {
    if (!sourceClientId) {
      setSourceSite(null);
      return;
    }
    const found = allStaticSites.find(s => s.client_id === sourceClientId) ?? null;
    setSourceSite(found);
  }, [sourceClientId, allStaticSites]);

  // ── When target changes, load their brief ─────────────────────────────
  useEffect(() => {
    if (!targetClientId) {
      setTargetBrief(null);
      return;
    }
    setLoadingTarget(true);
    supabase
      .from('website_briefs')
      .select('client_id, client_slug, business_name, phone, primary_color, email')
      .eq('client_id', targetClientId)
      .single()
      .then(({ data }) => {
        setTargetBrief(data as TargetBrief | null);
        setLoadingTarget(false);
      });
  }, [targetClientId]);

  // ── Build replacement rows whenever source or target changes ─────────
  useEffect(() => {
    if (!sourceSite) {
      setReplacements([]);
      return;
    }
    const rows: ReplacementRow[] = [
      {
        id: 1,
        label: 'Business Name',
        oldValue: sourceSite.business_name || '',
        newValue: targetBrief?.business_name || '',
        type: 'text',
      },
      {
        id: 2,
        label: 'Phone',
        oldValue: sourceSite.phone || '',
        newValue: targetBrief?.phone || '',
        type: 'text',
      },
      {
        id: 3,
        label: 'Primary Color',
        oldValue: sourceSite.primary_color || '#4F46E5',
        newValue: targetBrief?.primary_color || '#4F46E5',
        type: 'color',
      },
      {
        id: 4,
        label: 'Email',
        oldValue: sourceSite.email || '',
        newValue: targetBrief?.email || '',
        type: 'text',
      },
    ];
    setReplacements(rows);
  }, [sourceSite, targetBrief]);

  // ─── Template Management Actions ─────────────────────────────────────────

  const markAsTemplate = async (clientId: string, isTemplate: boolean) => {
    setSavingTemplate(clientId);
    const name = editingTemplateName[clientId] || allStaticSites.find(s => s.client_id === clientId)?.template_name || allStaticSites.find(s => s.client_id === clientId)?.business_name || '';
    await supabase
      .from('website_briefs')
      .update({ is_template: isTemplate, template_name: isTemplate ? name : null })
      .eq('client_id', clientId);
    setSavingTemplate(null);
    loadStaticSites();
  };

  const saveTemplateName = async (clientId: string) => {
    const name = editingTemplateName[clientId];
    if (!name) return;
    setSavingTemplate(clientId);
    await supabase
      .from('website_briefs')
      .update({ template_name: name })
      .eq('client_id', clientId);
    setSavingTemplate(null);
    setEditingTemplateName(prev => {
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
    loadStaticSites();
  };

  // ─── Clone Actions ────────────────────────────────────────────────────────

  const addCustomRow = () => {
    setReplacements(prev => [
      ...prev,
      { id: nextRowId, label: 'Custom', oldValue: '', newValue: '', type: 'text' },
    ]);
    setNextRowId(n => n + 1);
  };

  const removeRow = (id: number) => {
    setReplacements(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: 'oldValue' | 'newValue' | 'label', value: string) => {
    setReplacements(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const buildReplacementsPayload = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const row of replacements) {
      if (row.oldValue.trim()) {
        result[row.oldValue] = row.newValue;
      }
    }
    return result;
  };

  const handleClone = async () => {
    setCloning(true);
    setCloneResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clone-static-site`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            source_client_id: sourceClientId,
            target_client_id: targetClientId,
            replacements: buildReplacementsPayload(),
          }),
        }
      );
      const json = await response.json();
      if (!response.ok) {
        setCloneResult({ success: false, message: json.error || json.message || `HTTP ${response.status}` });
      } else {
        setCloneResult({
          success: true,
          message: json.message || 'Clone complete!',
          target_slug: json.target_slug,
          copied_count: json.copied_count,
          failed_count: json.failed_count,
        });
      }
    } catch (err: unknown) {
      setCloneResult({ success: false, message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setCloning(false);
    }
  };

  const resetClone = () => {
    setStep(1);
    setSourceClientId('');
    setSourceSite(null);
    setTargetClientId('');
    setTargetBrief(null);
    setReplacements([]);
    setCloneResult(null);
  };

  // ─── Derived data ─────────────────────────────────────────────────────────

  const templates = allStaticSites.filter(s => s.is_template);
  const shownSites = showAllSites ? allStaticSites : templates;
  const activeReplacements = replacements.filter(r => r.oldValue.trim());
  const targetClient = targetClients.find(c => c.id === targetClientId);
  const targetHasNoSlug = targetBrief !== null && !targetBrief.client_slug;
  const targetHasNoBrief = targetClientId && !loadingTarget && targetBrief === null;

  // Step validity
  const step1Valid = !!sourceClientId;
  const step2Valid = !!targetClientId && !targetHasNoBrief && !targetHasNoSlug;
  const step3Valid = true; // replacements are optional

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Copy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Clone Site as Template</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Copy a static site to a new client with brand replacement</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
          {([['clone', 'Clone a Site'], ['templates', 'Manage Templates']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
                activeTab === t
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ═══ TAB: MANAGE TEMPLATES ═══════════════════════════════════════════ */}
        {activeTab === 'templates' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                {showAllSites ? 'All Static Sites' : 'Template Library'}
              </h2>
              <button
                onClick={() => setShowAllSites(v => !v)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showAllSites ? 'Show templates only' : 'Show all static sites'}
              </button>
            </div>

            {loadingTemplates ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : shownSites.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                {showAllSites ? 'No static sites found.' : 'No templates yet. Click "Show all static sites" to mark one as a template.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Template Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Business</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Slug</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {shownSites.map(site => {
                      const isSaving = savingTemplate === site.client_id;
                      const editName = editingTemplateName[site.client_id];
                      const displayName = editName !== undefined
                        ? editName
                        : (site.template_name || site.business_name);
                      return (
                        <tr key={site.client_id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none w-44"
                                value={displayName}
                                onChange={e => setEditingTemplateName(prev => ({ ...prev, [site.client_id]: e.target.value }))}
                                placeholder="Template name…"
                              />
                              {editName !== undefined && editName !== (site.template_name || site.business_name) && (
                                <button
                                  onClick={() => saveTemplateName(site.client_id)}
                                  disabled={isSaving}
                                  className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                  title="Save name"
                                >
                                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{site.business_name}</td>
                          <td className="px-4 py-3">
                            {site.client_slug ? (
                              <a
                                href={`/site/${site.client_slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                              >
                                {site.client_slug}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-400 italic">none</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {site.is_template ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <CheckCircle className="w-3 h-3" /> Template
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                Not a template
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => markAsTemplate(site.client_id, !site.is_template)}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                site.is_template
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30'
                              }`}
                            >
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : site.is_template ? <X className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                              {site.is_template ? 'Remove Template' : 'Mark as Template'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: CLONE A SITE ═══════════════════════════════════════════════ */}
        {activeTab === 'clone' && (
          <div>
            {/* Stepper */}
            <div className="flex items-center gap-0 mb-8">
              {([1, 2, 3, 4] as CloneStep[]).map((s, idx) => (
                <React.Fragment key={s}>
                  <button
                    onClick={() => {
                      if (s < step || (s === 2 && step1Valid) || (s === 3 && step1Valid && step2Valid) || (s === 4 && step1Valid && step2Valid && step3Valid)) {
                        setStep(s);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      step === s
                        ? 'bg-indigo-600 text-white shadow'
                        : s < step
                          ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 cursor-pointer'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step === s ? 'bg-white text-indigo-600' : s < step ? 'bg-indigo-600 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-500'
                    }`}>
                      {s < step ? '✓' : s}
                    </span>
                    {stepLabel(s)}
                  </button>
                  {idx < 3 && (
                    <ChevronRight className={`w-4 h-4 mx-1 flex-shrink-0 ${s < step ? 'text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ── Step 1: Pick Source ─────────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
                    Step 1 — Pick a Source Site
                  </h2>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Source static site
                  </label>
                  {loadingTemplates ? (
                    <div className="flex items-center gap-2 text-slate-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading sites…
                    </div>
                  ) : (
                    <select
                      value={sourceClientId}
                      onChange={e => setSourceClientId(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">— Select a site —</option>
                      {allStaticSites.map(s => (
                        <option key={s.client_id} value={s.client_id}>
                          {s.business_name}{s.is_template && s.template_name ? ` (${s.template_name})` : ''} — {s.client_slug || 'no slug'}
                        </option>
                      ))}
                    </select>
                  )}

                  {sourceSite && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm space-y-1.5">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Source details</p>
                      <p className="text-slate-600 dark:text-slate-400"><span className="font-medium">Business:</span> {sourceSite.business_name}</p>
                      <p className="text-slate-600 dark:text-slate-400"><span className="font-medium">Phone:</span> {sourceSite.phone || '—'}</p>
                      <p className="text-slate-600 dark:text-slate-400"><span className="font-medium">Email:</span> {sourceSite.email || '—'}</p>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Primary Color:</span>
                        <span
                          className="w-5 h-5 rounded border border-slate-300 inline-block"
                          style={{ background: sourceSite.primary_color || '#4F46E5' }}
                        />
                        {sourceSite.primary_color || '#4F46E5'}
                      </div>
                      {sourceSite.client_slug && (
                        <a
                          href={`/site/${sourceSite.client_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                        >
                          Preview site <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    disabled={!step1Valid}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next: Pick Target →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Pick Target ─────────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
                    Step 2 — Pick a Target Client
                  </h2>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Target client (will receive the cloned site)
                  </label>
                  <select
                    value={targetClientId}
                    onChange={e => setTargetClientId(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">— Select a client —</option>
                    {targetClients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.business_name}
                      </option>
                    ))}
                  </select>

                  {loadingTarget && (
                    <div className="flex items-center gap-2 text-slate-400 py-2 mt-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading brief…
                    </div>
                  )}

                  {targetHasNoBrief && (
                    <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>This client doesn't have a website_briefs record yet. A record with <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">client_slug</code> set is required before cloning.</span>
                    </div>
                  )}

                  {targetHasNoSlug && (
                    <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>This client's website_briefs record doesn't have a <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">client_slug</code> set. Please set one first.</span>
                    </div>
                  )}

                  {targetBrief && targetBrief.client_slug && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm space-y-1.5">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Target details</p>
                      <p className="text-slate-600 dark:text-slate-400"><span className="font-medium">Business:</span> {targetBrief.business_name}</p>
                      <p className="text-slate-600 dark:text-slate-400"><span className="font-medium">Slug:</span> {targetBrief.client_slug}</p>
                      <p className="text-slate-600 dark:text-slate-400"><span className="font-medium">Phone:</span> {targetBrief.phone || '—'}</p>
                      <p className="text-slate-600 dark:text-slate-400"><span className="font-medium">Email:</span> {targetBrief.email || '—'}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!step2Valid}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next: Brand Replacements →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Brand Replacements ──────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Step 3 — Brand Replacements
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Define what to find and replace across all HTML, CSS, and JS files. Replacements are case-sensitive.
                  </p>

                  {/* Warning banner */}
                  <div className="flex items-start gap-2 p-3 mb-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Image files are copied as-is. To swap logos or photos, upload new images after cloning via the <strong>Static Upload</strong> tool.</span>
                  </div>

                  {/* Replacement table */}
                  <div className="space-y-2">
                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 px-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Field</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Current value (find)</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">New value (replace)</span>
                      <span />
                    </div>

                    {replacements.map(row => (
                      <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
                        <input
                          className="border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={row.label}
                          onChange={e => updateRow(row.id, 'label', e.target.value)}
                          placeholder="Label"
                        />
                        <div>
                          {row.type === 'color' ? (
                            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800">
                              <input
                                type="color"
                                value={row.oldValue || '#4F46E5'}
                                onChange={e => updateRow(row.id, 'oldValue', e.target.value)}
                                className="w-5 h-5 rounded border-0 cursor-pointer p-0 bg-transparent"
                              />
                              <input
                                className="flex-1 text-sm bg-transparent text-slate-900 dark:text-slate-100 outline-none"
                                value={row.oldValue}
                                onChange={e => updateRow(row.id, 'oldValue', e.target.value)}
                              />
                            </div>
                          ) : (
                            <input
                              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={row.oldValue}
                              onChange={e => updateRow(row.id, 'oldValue', e.target.value)}
                              placeholder="Current value…"
                            />
                          )}
                        </div>
                        <div>
                          {row.type === 'color' ? (
                            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800">
                              <input
                                type="color"
                                value={row.newValue || '#4F46E5'}
                                onChange={e => updateRow(row.id, 'newValue', e.target.value)}
                                className="w-5 h-5 rounded border-0 cursor-pointer p-0 bg-transparent"
                              />
                              <input
                                className="flex-1 text-sm bg-transparent text-slate-900 dark:text-slate-100 outline-none"
                                value={row.newValue}
                                onChange={e => updateRow(row.id, 'newValue', e.target.value)}
                              />
                            </div>
                          ) : (
                            <input
                              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={row.newValue}
                              onChange={e => updateRow(row.id, 'newValue', e.target.value)}
                              placeholder="New value…"
                            />
                          )}
                        </div>
                        <button
                          onClick={() => removeRow(row.id)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={addCustomRow}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors border border-dashed border-indigo-300 dark:border-indigo-700 mt-2"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Custom Replacement
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                    Rows with an empty "Current value" are skipped. {activeReplacements.length} replacement{activeReplacements.length !== 1 ? 's' : ''} will be applied.
                  </p>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"
                  >
                    Next: Review & Clone →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Review & Clone ───────────────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-6">
                {cloneResult ? (
                  /* ── Result state ── */
                  cloneResult.success ? (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Clone Successful!</h3>
                          <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-3">{cloneResult.message}</p>
                          <p className="text-sm text-emerald-700 dark:text-emerald-400">
                            Files copied: <strong>{cloneResult.copied_count ?? 0}</strong>
                            {(cloneResult.failed_count ?? 0) > 0 && (
                              <span className="ml-2 text-amber-600 dark:text-amber-400">· Failed: {cloneResult.failed_count}</span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-4">
                            {cloneResult.target_slug && (
                              <a
                                href={`/site/${cloneResult.target_slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" /> Preview Cloned Site
                              </a>
                            )}
                            <button
                              onClick={() => navigate('/admin/site-import')}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Upload className="w-4 h-4" /> Go to Static Upload
                            </button>
                            <button
                              onClick={resetClone}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Copy className="w-4 h-4" /> Clone Another Site
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-base font-semibold text-red-800 dark:text-red-300 mb-1">Clone Failed</h3>
                          <p className="text-sm text-red-700 dark:text-red-400">{cloneResult.message}</p>
                          <button
                            onClick={() => setCloneResult(null)}
                            className="mt-3 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  /* ── Review state ── */
                  <>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">
                        Step 4 — Review & Clone
                      </h2>

                      {/* Summary card */}
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-5">
                        <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{sourceSite?.business_name}</span>
                          <ChevronRight className="w-4 h-4 text-indigo-400" />
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{targetClient?.business_name}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Target slug: <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">{targetBrief?.client_slug}</code>
                        </div>
                        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          {activeReplacements.length} replacement{activeReplacements.length !== 1 ? 's' : ''} will be applied across all text files.
                        </div>
                      </div>

                      {/* Replacements summary */}
                      {activeReplacements.length > 0 && (
                        <div className="mb-5">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Replacements</p>
                          <div className="space-y-1.5">
                            {activeReplacements.map(row => (
                              <div key={row.id} className="flex items-center gap-2 text-sm">
                                <span className="w-28 text-slate-400 dark:text-slate-500 text-xs">{row.label}</span>
                                <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-700 dark:text-slate-300 max-w-[140px] truncate">{row.oldValue}</code>
                                <span className="text-slate-400">→</span>
                                {row.type === 'color' ? (
                                  <div className="flex items-center gap-1">
                                    <span className="w-4 h-4 rounded border border-slate-200 dark:border-slate-600 inline-block" style={{ background: row.newValue }} />
                                    <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-700 dark:text-slate-300">{row.newValue}</code>
                                  </div>
                                ) : (
                                  <code className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded text-xs font-mono text-indigo-700 dark:text-indigo-300 max-w-[140px] truncate">{row.newValue || '(empty)'}</code>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Image warning */}
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>Image files are copied as-is. To swap logos or photos, use the <strong>Static Upload</strong> tool after cloning.</span>
                      </div>

                      {/* Clone button */}
                      <button
                        onClick={handleClone}
                        disabled={cloning}
                        className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold text-base transition-colors shadow-sm"
                      >
                        {cloning ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Cloning — please wait…
                          </>
                        ) : (
                          <>
                            <Copy className="w-5 h-5" />
                            Clone Site
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => setStep(3)}
                        disabled={cloning}
                        className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                      >
                        ← Back
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
