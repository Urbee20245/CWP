"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Globe, Loader2, AlertTriangle, CheckCircle, Eye, Copy, RefreshCw, ToggleLeft, ToggleRight, Wand2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import { WebsiteBrief, GenerationStatus } from '../types/website';

interface Client {
  id: string;
  business_name: string;
  billing_email: string;
}

const TONES = ['Professional', 'Friendly', 'Bold', 'Luxurious'] as const;

const statusBadge = (status: GenerationStatus) => {
  const map: Record<GenerationStatus, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
    generating: { label: 'Generating...', className: 'bg-amber-100 text-amber-700' },
    complete: { label: 'Complete', className: 'bg-emerald-100 text-emerald-700' },
    error: { label: 'Error', className: 'bg-red-100 text-red-700' },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
};

const AdminWebsiteBuilder: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [brief, setBrief] = useState<WebsiteBrief | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [form, setForm] = useState({
    business_name: '',
    industry: '',
    services_offered: '',
    location: '',
    tone: 'Professional' as typeof TONES[number],
    primary_color: '#4F46E5',
    art_direction: '',
  });

  // Load clients
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, business_name, billing_email')
        .order('business_name');
      setClients(data || []);
      setLoadingClients(false);
    };
    load();
  }, []);

  // Load existing brief when client changes
  const loadBrief = useCallback(async (clientId: string) => {
    if (!clientId) return;
    setLoadingBrief(true);
    setError(null);
    const { data } = await supabase
      .from('website_briefs')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (data) {
      setBrief(data as WebsiteBrief);
      setForm({
        business_name: data.business_name || '',
        industry: data.industry || '',
        services_offered: data.services_offered || '',
        location: data.location || '',
        tone: data.tone || 'Professional',
        primary_color: data.primary_color || '#4F46E5',
        art_direction: data.art_direction || '',
      });
    } else {
      setBrief(null);
      // Pre-fill business name from client
      const client = clients.find(c => c.id === clientId);
      setForm(f => ({ ...f, business_name: client?.business_name || '' }));
    }
    setLoadingBrief(false);
  }, [clients]);

  useEffect(() => {
    if (selectedClientId) loadBrief(selectedClientId);
  }, [selectedClientId, loadBrief]);

  const handleGenerate = async () => {
    if (!selectedClientId) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await AdminService.generateWebsite({
        client_id: selectedClientId,
        ...form,
      });
      // Reload brief from DB
      await loadBrief(selectedClientId);
    } catch (err: any) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!brief) return;
    setIsTogglingPublish(true);
    try {
      await AdminService.updateWebsitePublish(selectedClientId, !brief.is_published);
      setBrief(prev => prev ? { ...prev, is_published: !prev.is_published } : null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const copyUrl = () => {
    if (!brief?.client_slug) return;
    const url = `${window.location.origin}/site/${brief.client_slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const previewUrl = brief?.client_slug ? `/site/${brief.client_slug}` : null;
  const hasWebsite = brief?.generation_status === 'complete' && brief.website_json;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Globe className="w-8 h-8 text-indigo-600" />
            Website Builder
          </h1>
          <p className="text-slate-500 mt-1">
            Fill in the client brief and AI will design a unique website for them.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Brief Form */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Client Brief</h2>

              {/* Client selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  disabled={loadingClients}
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.business_name}</option>
                  ))}
                </select>
              </div>

              {/* Business name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.business_name}
                  onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                  placeholder="Acme Plumbing"
                />
              </div>

              {/* Industry */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Industry / Niche</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.industry}
                  onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                  placeholder="Plumbing, HVAC, Interior Design..."
                />
              </div>

              {/* Services */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Services Offered</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                  value={form.services_offered}
                  onChange={e => setForm(f => ({ ...f, services_offered: e.target.value }))}
                  placeholder="Emergency repairs, water heater install, drain cleaning..."
                />
              </div>

              {/* Location */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Atlanta, GA"
                />
              </div>

              {/* Tone */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand Tone</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.tone}
                  onChange={e => setForm(f => ({ ...f, tone: e.target.value as any }))}
                >
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Brand color */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Primary Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer"
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                  />
                  <span className="text-sm text-slate-500 font-mono">{form.primary_color}</span>
                </div>
              </div>

              {/* Art direction */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Art Direction <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                  value={form.art_direction}
                  onChange={e => setForm(f => ({ ...f, art_direction: e.target.value }))}
                  placeholder="She wants it to feel luxurious, minimal, lots of white space. Her photos should be the star..."
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedClientId || !form.business_name || !form.industry || !form.services_offered || !form.location}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : hasWebsite ? (
                  <><RefreshCw className="w-4 h-4" /> Regenerate</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Generate Website</>
                )}
              </button>
            </div>
          </div>

          {/* Right: Output */}
          <div className="lg:col-span-2">
            {!selectedClientId ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <Globe className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500">Select a client and fill in the brief to generate their website.</p>
              </div>
            ) : loadingBrief ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : isGenerating ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                <p className="text-slate-700 font-medium">AI is designing the website...</p>
                <p className="text-slate-400 text-sm mt-1">This takes about 15–30 seconds</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Generation failed</p>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="mt-3 text-sm text-red-700 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ) : hasWebsite ? (
              <div className="space-y-4">
                {/* Actions bar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
                  {statusBadge(brief!.generation_status)}

                  <span className="text-sm text-slate-500 font-mono">
                    /site/{brief!.client_slug}
                  </span>

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Publish toggle */}
                    <button
                      onClick={handleTogglePublish}
                      disabled={isTogglingPublish}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                      style={
                        brief!.is_published
                          ? { borderColor: '#10b981', color: '#059669', backgroundColor: '#f0fdf4' }
                          : { borderColor: '#e2e8f0', color: '#64748b', backgroundColor: '#f8fafc' }
                      }
                    >
                      {brief!.is_published ? (
                        <><ToggleRight className="w-4 h-4" /> Published</>
                      ) : (
                        <><ToggleLeft className="w-4 h-4" /> Draft</>
                      )}
                    </button>

                    {/* Preview */}
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" /> Preview
                      </a>
                    )}

                    {/* Copy URL */}
                    <button
                      onClick={copyUrl}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {copied ? <><CheckCircle className="w-4 h-4 text-emerald-500" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy URL</>}
                    </button>
                  </div>
                </div>

                {/* Website JSON preview */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Website Structure</h3>

                  {/* Global */}
                  <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm">
                    <p className="font-medium text-slate-700 mb-1">Global</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-500">
                      <span>Font: {brief!.website_json!.global.font_heading}</span>
                      <span>Color: {brief!.website_json!.global.primary_color}</span>
                      <span>Phone: {brief!.website_json!.global.phone || '—'}</span>
                      <span>Address: {brief!.website_json!.global.address || '—'}</span>
                    </div>
                  </div>

                  {/* SEO */}
                  <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm">
                    <p className="font-medium text-slate-700 mb-1">SEO</p>
                    <p className="text-slate-500">{brief!.website_json!.seo.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{brief!.website_json!.seo.meta_description}</p>
                  </div>

                  {/* Sections */}
                  <div className="space-y-2">
                    <p className="font-medium text-slate-700 text-sm mb-2">Sections ({brief!.website_json!.page_structure.length})</p>
                    {brief!.website_json!.page_structure.map((section, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 border border-slate-100 rounded-xl">
                        <span className="text-xs font-mono bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded mt-0.5 flex-shrink-0">
                          {section.section_type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-600">
                            Variant: <span className="font-medium text-slate-800">{section.variant}</span>
                          </p>
                          {section.editable_fields.length > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Client can edit: {section.editable_fields.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : brief?.generation_status === 'error' ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
                <p className="font-semibold text-red-800">Previous generation failed</p>
                <p className="text-red-600 text-sm mt-1">{brief.generation_error}</p>
                <p className="text-slate-500 text-sm mt-3">Update the brief and click Generate again.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <Wand2 className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-600 font-medium">Ready to generate</p>
                <p className="text-slate-400 text-sm mt-1">Fill in the brief and click Generate Website.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminWebsiteBuilder;
