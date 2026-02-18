"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import {
  Globe, Loader2, AlertTriangle, CheckCircle, Eye, Copy, EyeOff, ExternalLink,
  RefreshCw, ToggleLeft, ToggleRight, Wand2, Upload, ImageIcon,
  ChevronDown, ChevronRight, FileText, Check, Link, Save, Info, Key,
  Calendar, Phone, FileText as FormIcon, Shield, Sparkles, MessageSquare, LayoutDashboard,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import {
  WebsiteBrief, GenerationStatus, ALL_PAGE_OPTIONS, PageId,
  PremiumFeatureId, PREMIUM_FEATURE_OPTIONS, PREMIUM_FEATURE_GROUPS, PremiumFeatureGroup,
} from '../types/website';

interface Client {
  id: string;
  business_name: string;
  billing_email: string;
}

const TONES = ['Professional', 'Friendly', 'Bold', 'Luxurious'] as const;

const statusBadge = (status: GenerationStatus) => {
  const map: Record<GenerationStatus, { label: string; className: string }> = {
    draft:      { label: 'Draft',         className: 'bg-slate-100 text-slate-600' },
    generating: { label: 'Generating...', className: 'bg-amber-100 text-amber-700' },
    complete:   { label: 'Complete',      className: 'bg-emerald-100 text-emerald-700' },
    error:      { label: 'Error',         className: 'bg-red-100 text-red-700' },
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
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  // Custom domain state
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainSaved, setDomainSaved] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [showDnsInstructions, setShowDnsInstructions] = useState(false);

  // Registrar credentials state (read-only for admin)
  const [domainCreds, setDomainCreds] = useState<{
    registrar_name: string;
    login_url: string;
    username: string;
    password: string;
    notes: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Image upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

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

  // Page selection: default to home + about + services + contact
  const [selectedPages, setSelectedPages] = useState<Set<PageId>>(
    new Set(['home', 'about', 'services', 'contact'])
  );

  // Premium feature selection
  const [selectedPremiumFeatures, setSelectedPremiumFeatures] = useState<Set<PremiumFeatureId>>(new Set());

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
      // If existing pages, preselect them
      if (data.website_json?.pages) {
        setSelectedPages(new Set(data.website_json.pages.map((p: any) => p.id as PageId)));
      }
      // Restore premium features
      if (Array.isArray(data.premium_features) && data.premium_features.length > 0) {
        setSelectedPremiumFeatures(new Set(data.premium_features as PremiumFeatureId[]));
      } else {
        setSelectedPremiumFeatures(new Set());
      }
      // Restore custom domain
      setCustomDomainInput(data.custom_domain || '');
    } else {
      setBrief(null);
      setSelectedPremiumFeatures(new Set());
      setCustomDomainInput('');
      const client = clients.find(c => c.id === clientId);
      setForm(f => ({ ...f, business_name: client?.business_name || '' }));
    }

    // Load registrar credentials
    const { data: credsData } = await supabase
      .from('client_domain_credentials')
      .select('registrar_name, login_url, username, password, notes')
      .eq('client_id', clientId)
      .maybeSingle();

    setDomainCreds(credsData
      ? {
          registrar_name: credsData.registrar_name,
          login_url: credsData.login_url,
          username: credsData.username,
          password: credsData.password,
          notes: credsData.notes,
        }
      : null
    );
    setShowPassword(false);

    setLoadingBrief(false);
  }, [clients]);

  useEffect(() => {
    if (selectedClientId) loadBrief(selectedClientId);
  }, [selectedClientId, loadBrief]);

  const togglePage = (pageId: PageId) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (pageId === 'home') return next; // locked
      if (next.has(pageId)) { next.delete(pageId); } else { next.add(pageId); }
      return next;
    });
  };

  const togglePremiumFeature = (featureId: PremiumFeatureId) => {
    setSelectedPremiumFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) { next.delete(featureId); } else { next.add(featureId); }
      return next;
    });
  };

  const PREMIUM_GROUP_ICONS: Record<PremiumFeatureGroup, React.ReactNode> = {
    'Calendar':               <Calendar className="w-4 h-4" />,
    'AI Phone Receptionist':  <Phone className="w-4 h-4" />,
    'Forms':                  <FormIcon className="w-4 h-4" />,
    'Legal Pages':            <Shield className="w-4 h-4" />,
    'AI Functionality':       <Sparkles className="w-4 h-4" />,
    'Widgets & Chatbots':     <MessageSquare className="w-4 h-4" />,
    'Client Portal':          <LayoutDashboard className="w-4 h-4" />,
  };

  // Image upload handler
  const handleImageUpload = async (
    file: File,
    type: 'logo' | 'hero'
  ) => {
    if (!selectedClientId) return;
    setUploadError(null);
    const setter = type === 'logo' ? setUploadingLogo : setUploadingHero;
    setter(true);

    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${selectedClientId}/${type}.${ext}`;

      // Remove old file first (ignore error if doesn't exist)
      await supabase.storage.from('website-images').remove([path]);

      const { error: upErr } = await supabase.storage
        .from('website-images')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = supabase.storage
        .from('website-images')
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;
      const field = type === 'logo' ? 'logo_url' : 'hero_image_url';

      // Save URL into website_json.global (or create partial record)
      const currentJson = brief?.website_json || {};
      const updatedJson = {
        ...currentJson,
        global: {
          ...(currentJson as any).global,
          [field]: publicUrl,
        },
      };

      await supabase
        .from('website_briefs')
        .upsert(
          {
            client_id: selectedClientId,
            business_name: form.business_name || 'Draft',
            industry: form.industry || '',
            services_offered: form.services_offered || '',
            location: form.location || '',
            tone: form.tone,
            primary_color: form.primary_color,
            website_json: updatedJson,
          },
          { onConflict: 'client_id' }
        );

      // Refresh brief
      await loadBrief(selectedClientId);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setter(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedClientId) return;
    setIsGenerating(true);
    setError(null);
    try {
      // Persist premium feature selections to the brief row before/during generation
      await supabase
        .from('website_briefs')
        .upsert(
          {
            client_id: selectedClientId,
            business_name: form.business_name || 'Draft',
            industry: form.industry || '',
            services_offered: form.services_offered || '',
            location: form.location || '',
            tone: form.tone,
            primary_color: form.primary_color,
            premium_features: Array.from(selectedPremiumFeatures),
          },
          { onConflict: 'client_id' }
        );

      await AdminService.generateWebsite({
        client_id: selectedClientId,
        ...form,
        pages_to_generate: Array.from(selectedPages),
        premium_features: Array.from(selectedPremiumFeatures),
      });
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

  const handleSaveDomain = async () => {
    if (!selectedClientId) return;
    setSavingDomain(true);
    setDomainError(null);
    setDomainSaved(false);
    try {
      await AdminService.saveCustomDomain(selectedClientId, customDomainInput || null);
      setBrief(prev => prev ? { ...prev, custom_domain: customDomainInput || null } : null);
      setDomainSaved(true);
      setTimeout(() => setDomainSaved(false), 3000);
    } catch (err: any) {
      setDomainError(err.message || 'Failed to save domain.');
    } finally {
      setSavingDomain(false);
    }
  };

  const copyField = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
  const logoUrl = (brief?.website_json as any)?.global?.logo_url || '';
  const heroUrl = (brief?.website_json as any)?.global?.hero_image_url || '';

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Globe className="w-8 h-8 text-indigo-600" />
            Website Builder
          </h1>
          <p className="text-slate-500 mt-1">
            Configure the brief, select pages, upload assets, then let AI build the site.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Brief Form */}
          <div className="lg:col-span-1 space-y-5">

            {/* Brief card */}
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

              <div className="mb-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Art Direction <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                  value={form.art_direction}
                  onChange={e => setForm(f => ({ ...f, art_direction: e.target.value }))}
                  placeholder="Luxurious, minimal, lots of white space..."
                />
              </div>
            </div>

            {/* Pages card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Pages to Generate</h2>
              <p className="text-xs text-slate-400 mb-4">Select which pages AI should build. Home is always included.</p>
              <div className="space-y-2">
                {ALL_PAGE_OPTIONS.map(option => {
                  const isSelected = selectedPages.has(option.id);
                  const isLocked = option.locked;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => !isLocked && togglePage(option.id)}
                      disabled={isLocked}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                        isSelected
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      } ${isLocked ? 'opacity-75 cursor-default' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {option.name}
                          </span>
                          {isLocked && (
                            <span className="text-xs text-slate-400 font-mono">(always on)</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''} selected
              </p>
            </div>

            {/* Premium Features card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-slate-900">Premium Features</h2>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                Select add-ons to enable for this client's website. These are billed separately.
              </p>

              <div className="space-y-5">
                {PREMIUM_FEATURE_GROUPS.map(group => {
                  const featuresInGroup = PREMIUM_FEATURE_OPTIONS.filter(f => f.group === group);
                  const selectedInGroup = featuresInGroup.filter(f => selectedPremiumFeatures.has(f.id)).length;
                  return (
                    <div key={group}>
                      {/* Group header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-slate-400">{PREMIUM_GROUP_ICONS[group]}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group}</span>
                        {selectedInGroup > 0 && (
                          <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 font-medium px-2 py-0.5 rounded-full">
                            {selectedInGroup} on
                          </span>
                        )}
                      </div>

                      {/* Feature checkboxes */}
                      <div className="space-y-2">
                        {featuresInGroup.map(feature => {
                          const isSelected = selectedPremiumFeatures.has(feature.id);
                          return (
                            <button
                              key={feature.id}
                              type="button"
                              onClick={() => togglePremiumFeature(feature.id)}
                              className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                                isSelected
                                  ? 'border-amber-300 bg-amber-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 mt-0.5 transition-colors ${
                                  isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium ${isSelected ? 'text-amber-800' : 'text-slate-700'}`}>
                                    {feature.name}
                                  </span>
                                  {feature.badge && (
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                      feature.badge === 'Popular'
                                        ? 'bg-rose-100 text-rose-600'
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {feature.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{feature.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedPremiumFeatures.size > 0 && (
                <p className="text-xs text-amber-600 font-medium mt-4">
                  {selectedPremiumFeatures.size} premium feature{selectedPremiumFeatures.size !== 1 ? 's' : ''} enabled
                </p>
              )}
            </div>

            {/* Assets card */}
            {selectedClientId && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Assets</h2>
                <p className="text-xs text-slate-400 mb-4">Upload images — saved instantly, no regeneration needed.</p>

                {uploadError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {uploadError}
                  </div>
                )}

                {/* Logo */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Logo</label>
                  {logoUrl ? (
                    <div className="flex items-center gap-3 mb-2">
                      <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain rounded border border-slate-200" />
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Replace
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-60"
                    >
                      {uploadingLogo ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4" /> Upload Logo</>
                      )}
                    </button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'logo');
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Hero Image */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Hero Image</label>
                  {heroUrl ? (
                    <div className="mb-2">
                      <img
                        src={heroUrl}
                        alt="Hero"
                        className="w-full h-28 object-cover rounded-xl border border-slate-200"
                      />
                      <button
                        onClick={() => heroInputRef.current?.click()}
                        className="text-xs text-indigo-600 hover:underline mt-1"
                      >
                        Replace
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => heroInputRef.current?.click()}
                      disabled={uploadingHero}
                      className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-60"
                    >
                      {uploadingHero ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                      ) : (
                        <><ImageIcon className="w-4 h-4" /> Upload Hero Image</>
                      )}
                    </button>
                  )}
                  <input
                    ref={heroInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'hero');
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                !selectedClientId ||
                !form.business_name ||
                !form.industry ||
                !form.services_offered ||
                !form.location
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating {selectedPages.size} pages...</>
              ) : hasWebsite ? (
                <><RefreshCw className="w-4 h-4" /> Regenerate Website</>
              ) : (
                <><Wand2 className="w-4 h-4" /> Generate Website</>
              )}
            </button>
          </div>

          {/* Right: Output */}
          <div className="lg:col-span-2">
            {!selectedClientId ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <Globe className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500">Select a client and fill in the brief to get started.</p>
              </div>
            ) : loadingBrief ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : isGenerating ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <Loader2 className="w-14 h-14 animate-spin text-indigo-600" />
                </div>
                <p className="text-slate-700 font-semibold text-lg">AI is designing your website...</p>
                <p className="text-slate-400 text-sm mt-2">Building {selectedPages.size} pages. This takes 30–60 seconds.</p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {Array.from(selectedPages).map(pid => {
                    const opt = ALL_PAGE_OPTIONS.find(o => o.id === pid);
                    return opt ? (
                      <span key={pid} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                        {opt.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Generation failed</p>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                    <button onClick={() => setError(null)} className="mt-3 text-sm text-red-700 underline">
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
                  <span className="text-sm text-slate-500 font-mono">/site/{brief!.client_slug}</span>

                  <div className="flex items-center gap-2 ml-auto flex-wrap">
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
                      {brief!.is_published ? <><ToggleRight className="w-4 h-4" /> Published</> : <><ToggleLeft className="w-4 h-4" /> Draft</>}
                    </button>

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

                    <button
                      onClick={copyUrl}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {copied ? <><CheckCircle className="w-4 h-4 text-emerald-500" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy URL</>}
                    </button>
                  </div>
                </div>

                {/* Global settings */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wide">Global Settings</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-600">
                    <span><span className="font-medium text-slate-700">Font:</span> {brief!.website_json!.global.font_heading}</span>
                    <span><span className="font-medium text-slate-700">Color:</span> {brief!.website_json!.global.primary_color}</span>
                    <span><span className="font-medium text-slate-700">Phone:</span> {brief!.website_json!.global.phone || '—'}</span>
                    <span><span className="font-medium text-slate-700">Address:</span> {brief!.website_json!.global.address || '—'}</span>
                    {logoUrl && <span className="col-span-2 flex items-center gap-2"><span className="font-medium text-slate-700">Logo:</span> <img src={logoUrl} alt="logo" className="h-6" /></span>}
                  </div>
                </div>

                {/* Custom Domain card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Custom Domain</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Connect a domain the client purchased (e.g. Namecheap, Squarespace). Once set, visitors to that domain will see this site.
                  </p>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="www.clientsite.com"
                      value={customDomainInput}
                      onChange={e => setCustomDomainInput(e.target.value.trim().toLowerCase())}
                    />
                    <button
                      onClick={handleSaveDomain}
                      disabled={savingDomain}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {savingDomain ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : domainSaved ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> Saved</>
                      ) : (
                        <><Save className="w-3.5 h-3.5" /> Save</>
                      )}
                    </button>
                  </div>

                  {domainError && (
                    <p className="text-xs text-red-600 mb-3">{domainError}</p>
                  )}

                  {brief?.custom_domain && (
                    <p className="text-xs text-emerald-600 mb-3 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Connected: <span className="font-mono">{brief.custom_domain}</span>
                    </p>
                  )}

                  {/* DNS Instructions */}
                  <button
                    onClick={() => setShowDnsInstructions(o => !o)}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {showDnsInstructions ? 'Hide' : 'Show'} DNS setup instructions
                  </button>

                  {showDnsInstructions && (
                    <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-3">
                      <p className="font-semibold text-slate-700">Client DNS setup (Namecheap, Squarespace, etc.)</p>
                      <ol className="space-y-2 list-decimal list-inside">
                        <li>Log in to their domain registrar and go to <strong>DNS settings</strong>.</li>
                        <li>
                          Add a <strong>CNAME record</strong>:
                          <div className="mt-1 font-mono bg-white border border-slate-200 rounded p-2 text-xs">
                            <div>Host: <strong>www</strong></div>
                            <div>Value: <strong>cname.vercel-dns.com</strong></div>
                          </div>
                        </li>
                        <li>
                          For the root domain (<span className="font-mono">@</span>), add an <strong>A record</strong>:
                          <div className="mt-1 font-mono bg-white border border-slate-200 rounded p-2 text-xs">
                            <div>Host: <strong>@</strong></div>
                            <div>Value: <strong>76.76.21.21</strong></div>
                          </div>
                        </li>
                        <li>
                          In your <strong>Vercel project settings → Domains</strong>, add the client's domain. Vercel will auto-provision SSL.
                        </li>
                        <li>DNS changes take up to <strong>24–48 hours</strong> to propagate.</li>
                      </ol>
                    </div>
                  )}
                </div>

                {/* Registrar Login card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Registrar Login</h3>
                    {domainCreds?.registrar_name && (
                      <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
                        {domainCreds.registrar_name}
                      </span>
                    )}
                  </div>

                  {!domainCreds || !domainCreds.username ? (
                    <div className="px-5 py-8 text-center">
                      <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        Client hasn't entered registrar credentials yet.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Ask them to log into their client portal → My Website → Domain Registrar Access.
                      </p>
                    </div>
                  ) : (
                    <div className="p-5 space-y-3">
                      {/* Login URL */}
                      {domainCreds.login_url && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-500 w-20 flex-shrink-0">Login URL</span>
                          <a
                            href={domainCreds.login_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline truncate flex-1"
                          >
                            {domainCreds.login_url}
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          </a>
                        </div>
                      )}

                      {/* Username */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 w-20 flex-shrink-0">Username</span>
                        <span className="flex-1 text-sm text-slate-800 font-mono truncate">
                          {domainCreds.username}
                        </span>
                        <button
                          onClick={() => copyField(domainCreds.username, 'username')}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 flex-shrink-0"
                        >
                          {copiedField === 'username'
                            ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Copied</>
                            : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                        </button>
                      </div>

                      {/* Password */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 w-20 flex-shrink-0">Password</span>
                        <span className="flex-1 text-sm text-slate-800 font-mono truncate">
                          {showPassword ? domainCreds.password : '••••••••'}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setShowPassword(v => !v)}
                            className="text-slate-400 hover:text-indigo-600"
                          >
                            {showPassword
                              ? <EyeOff className="w-3.5 h-3.5" />
                              : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => copyField(domainCreds.password, 'password')}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600"
                          >
                            {copiedField === 'password'
                              ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Copied</>
                              : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      {domainCreds.notes && (
                        <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                          <p className="font-semibold mb-0.5">Notes from client:</p>
                          <p>{domainCreds.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Pages accordion */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      Pages <span className="text-slate-400 font-normal">({brief!.website_json!.pages.length})</span>
                    </h3>
                    <span className="text-xs text-slate-400">Click a page to expand sections</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {brief!.website_json!.pages.map((page) => {
                      const isExpanded = expandedPages[page.id] ?? false;
                      return (
                        <div key={page.id}>
                          <button
                            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                            onClick={() => setExpandedPages(prev => ({ ...prev, [page.id]: !isExpanded }))}
                          >
                            <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800 text-sm">{page.name}</span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {page.slug ? `/${page.slug}` : '/'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 truncate">{page.seo?.title}</p>
                            </div>
                            <span className="text-xs text-slate-400 mr-2">{page.sections.length} sections</span>
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-slate-400" />
                              : <ChevronRight className="w-4 h-4 text-slate-400" />
                            }
                          </button>

                          {isExpanded && (
                            <div className="px-5 pb-4 bg-slate-50">
                              {/* Page SEO */}
                              <div className="mb-3 p-3 bg-white rounded-xl border border-slate-100 text-xs">
                                <p className="font-medium text-slate-600 mb-1">SEO</p>
                                <p className="text-slate-800 font-medium">{page.seo?.title}</p>
                                <p className="text-slate-500 mt-0.5">{page.seo?.meta_description}</p>
                              </div>
                              {/* Sections */}
                              <div className="space-y-2">
                                {page.sections.map((section, si) => (
                                  <div key={si} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                                    <span className="text-xs font-mono bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded mt-0.5 flex-shrink-0">
                                      {section.section_type}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-slate-600">
                                        Variant: <span className="font-medium text-slate-800">{section.variant}</span>
                                      </p>
                                      {section.editable_fields.length > 0 && (
                                        <p className="text-xs text-slate-400 mt-0.5">
                                          Editable: {section.editable_fields.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                <p className="text-slate-400 text-sm mt-1">
                  Fill in the brief, choose your pages, then click Generate Website.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminWebsiteBuilder;
