"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import AdminLayout from '../components/AdminLayout';
import {
  Download, Loader2, AlertTriangle, CheckCircle, Eye, Copy, ExternalLink,
  Globe, Link, Upload, FileArchive, ChevronDown, ChevronRight, FileText,
  Check, Save, Info, Calendar, Phone, FileText as FormIcon, Shield,
  Sparkles, MessageSquare, LayoutDashboard, ArrowRight, ToggleLeft,
  ToggleRight, AlertCircle, Code2, Database, Search, Github, X,
  CloudUpload, Zap,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import {
  WebsiteBrief, ALL_PAGE_OPTIONS, PageId,
  PremiumFeatureId, PREMIUM_FEATURE_OPTIONS, PREMIUM_FEATURE_GROUPS,
  PremiumFeatureGroup, GenerationStatus,
} from '../types/website';
import { AI_PROVIDER_OPTIONS, DEFAULT_PROVIDER_ID, getProviderOption } from '../constants/aiProviders';
import ProvisioningProgress, { useProvisioningSteps } from '../components/ProvisioningProgress';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  business_name: string;
  billing_email: string;
}

type ImportSource = 'url' | 'github' | 'zip';

type ImportStep = 'configure' | 'importing' | 'done';

const BACKEND_FEATURE_LABELS: Record<string, { label: string; action: string; icon: React.ReactNode }> = {
  contact_form: {
    label: 'Contact Forms',
    action: 'Enable the "Smart Contact Forms" premium feature — CWP routes form submissions to Supabase edge functions.',
    icon: <FormIcon className="w-4 h-4 text-amber-500" />,
  },
  php_backend: {
    label: 'PHP Backend',
    action: 'PHP server logic must be rewritten as Supabase Edge Functions (Deno/TypeScript). Map each PHP endpoint to a new function.',
    icon: <Code2 className="w-4 h-4 text-orange-500" />,
  },
  wordpress_cms: {
    label: 'WordPress CMS',
    action: 'CWP replaces WordPress entirely. Blog posts can be managed via the Blog Manager. Migrate post content manually.',
    icon: <Database className="w-4 h-4 text-blue-500" />,
  },
  api_calls: {
    label: 'REST API Calls',
    action: 'Client-side API calls must be proxied through Supabase Edge Functions to protect credentials and enforce CORS.',
    icon: <ArrowRight className="w-4 h-4 text-purple-500" />,
  },
  auth_pages: {
    label: 'Authentication / Login',
    action: 'Replace with Supabase Auth + the CWP Client Back Office premium feature for client portal access.',
    icon: <Shield className="w-4 h-4 text-indigo-500" />,
  },
  ecommerce: {
    label: 'E-commerce / Checkout',
    action: 'CWP integrates with Stripe for payments. Migrate product catalog and use the existing invoice/billing edge functions.',
    icon: <Download className="w-4 h-4 text-emerald-500" />,
  },
  comments: {
    label: 'User Comments',
    action: 'Replace with a Supabase table for comments, or remove if not core to the business.',
    icon: <MessageSquare className="w-4 h-4 text-slate-500" />,
  },
  search: {
    label: 'Site Search',
    action: 'Implement a Supabase full-text search edge function, or use a client-side search library (Fuse.js).',
    icon: <Search className="w-4 h-4 text-slate-500" />,
  },
  analytics: {
    label: 'Analytics Scripts',
    action: 'Re-add tracking scripts via the site global settings or by editing the SiteRenderer head template.',
    icon: <LayoutDashboard className="w-4 h-4 text-green-500" />,
  },
  spam_protection: {
    label: 'CAPTCHA / Spam Protection',
    action: 'Re-enable reCAPTCHA or hCaptcha on the Supabase submit-contact-form edge function.',
    icon: <Shield className="w-4 h-4 text-rose-500" />,
  },
};

const statusBadge = (status: GenerationStatus) => {
  const map: Record<GenerationStatus, { label: string; className: string }> = {
    draft:      { label: 'Draft',         className: 'bg-slate-100 text-slate-600' },
    generating: { label: 'Importing...', className: 'bg-amber-100 text-amber-700' },
    complete:   { label: 'Imported',      className: 'bg-emerald-100 text-emerald-700' },
    error:      { label: 'Error',         className: 'bg-red-100 text-red-700' },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
};

const TONES = ['Professional', 'Friendly', 'Bold', 'Luxurious'] as const;

// ─── Component ─────────────────────────────────────────────────────────────────

type MainTab = 'import' | 'static-upload';

const AdminSiteImport: React.FC = () => {
  // ── Main tab ───────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('import');

  // ── Clients ────────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);
  const [brief, setBrief] = useState<WebsiteBrief | null>(null);

  // ── Static site upload ─────────────────────────────────────────────────────
  const [staticClientId, setStaticClientId] = useState('');
  const [staticZipFile, setStaticZipFile] = useState<File | null>(null);
  const [staticDomain, setStaticDomain] = useState('');
  const [staticUploading, setStaticUploading] = useState(false);
  const [staticTotal, setStaticTotal] = useState(0);
  const [staticProgress, setStaticProgress] = useState(0);
  const [staticError, setStaticError] = useState<string | null>(null);
  const [staticSuccess, setStaticSuccess] = useState<string | null>(null);
  const [staticIsDragging, setStaticIsDragging] = useState(false);
  const staticZipRef = useRef<HTMLInputElement>(null);

  // ── Import source ──────────────────────────────────────────────────────────
  const [importSource, setImportSource] = useState<ImportSource>('url');
  const [urlInput, setUrlInput] = useState('');
  const [githubUrlInput, setGithubUrlInput] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // ── Site config ────────────────────────────────────────────────────────────
  const [slugInput, setSlugInput] = useState('');
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [toneInput, setToneInput] = useState<typeof TONES[number]>('Professional');
  const [primaryColorInput, setPrimaryColorInput] = useState('#4F46E5');
  const [overridePrimaryColor, setOverridePrimaryColor] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(DEFAULT_PROVIDER_ID);
  const [selectedPremiumFeatures, setSelectedPremiumFeatures] = useState<Set<PremiumFeatureId>>(new Set());
  const [collapsedFeatureGroups, setCollapsedFeatureGroups] = useState<Record<string, boolean>>({});

  // ── Import state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<ImportStep>('configure');
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    client_slug: string;
    website_json?: any;
    backend_features?: string[];
    pages_imported?: number;
    business_name: string;
    exact_clone?: boolean;
    html_size_kb?: number;
    site_type?: string;
  } | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const [showDnsInstructions, setShowDnsInstructions] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    source: true,
    config: true,
    features: false,
  });

  const toggleSection = (k: string) => setOpenSections(p => ({ ...p, [k]: !p[k] }));
  const toggleFeatureGroup = (g: string) =>
    setCollapsedFeatureGroups(p => ({ ...p, [g]: !p[g] }));

  // ── Provisioning progress (autonomous mode) ────────────────────────────────
  const isImporting = step === 'importing';
  const { steps: provisioningSteps, clear: clearProvisioning } = useProvisioningSteps(
    selectedClientId || null,
    isImporting,
  );
  const [showProvisioningPanel, setShowProvisioningPanel] = useState(false);

  // Show provisioning panel as soon as any resources arrive
  useEffect(() => {
    if (provisioningSteps.length > 0) setShowProvisioningPanel(true);
  }, [provisioningSteps.length]);

  // Hide panel on new import start
  useEffect(() => {
    if (step === 'importing') {
      setShowProvisioningPanel(false);
      clearProvisioning();
    }
  }, [step]);

  // ── Load clients ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, business_name, billing_email')
        .order('business_name');
      setClients(data || []);
      setLoadingClients(false);
    })();
  }, []);

  // ── Load existing brief when client changes ────────────────────────────────
  const loadBrief = useCallback(async (clientId: string) => {
    if (!clientId) return;
    const { data } = await supabase
      .from('website_briefs')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();
    setBrief((data as WebsiteBrief) || null);
    if (data?.client_slug) setSlugInput(data.client_slug);
    if (data?.custom_domain) setCustomDomainInput(data.custom_domain);
    if (Array.isArray(data?.premium_features)) {
      setSelectedPremiumFeatures(new Set(data.premium_features as PremiumFeatureId[]));
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) loadBrief(selectedClientId);
  }, [selectedClientId, loadBrief]);

  // ── Premium feature toggle ─────────────────────────────────────────────────
  const togglePremiumFeature = (id: PremiumFeatureId) => {
    setSelectedPremiumFeatures(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  // ── File drag/drop ─────────────────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.zip') || file.type === 'application/zip')) {
      setZipFile(file);
    }
  };

  // ── Convert File to base64 ─────────────────────────────────────────────────
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip "data:...;base64," prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
    });

  // ── Validate before importing ──────────────────────────────────────────────
  const canImport =
    !!selectedClientId &&
    (importSource === 'url'
      ? urlInput.trim().length > 4
      : importSource === 'github'
      ? githubUrlInput.trim().includes('github.com')
      : !!zipFile);

  // ── Handle import ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!canImport) return;
    setStep('importing');
    setImportError(null);
    setResult(null);

    try {
      const payload: Record<string, any> = {
        client_id: selectedClientId,
        source_type: importSource,
        slug: slugInput.trim() || undefined,
        custom_domain: customDomainInput.trim() || undefined,
        tone: toneInput,
        primary_color: overridePrimaryColor ? primaryColorInput : undefined,
        premium_features: Array.from(selectedPremiumFeatures),
        ai_provider: selectedProvider,
      };

      if (importSource === 'url') {
        payload.url = urlInput.trim();
      } else if (importSource === 'github') {
        payload.github_url = githubUrlInput.trim();
      } else {
        payload.zip_base64 = await fileToBase64(zipFile!);
      }

      const data = await AdminService.importSite(payload);
      setResult(data);
      setStep('done');
      await loadBrief(selectedClientId);
    } catch (err: any) {
      setImportError(err.message || 'Import failed. Please try again.');
      setStep('configure');
    }
  };

  // ── Handle exact clone (pixel-perfect raw HTML mode) ──────────────────────
  const handleExactClone = async () => {
    if (!canImport || importSource !== 'url') return;
    setStep('importing');
    setImportError(null);
    setResult(null);

    try {
      const data = await AdminService.cloneSiteExact({
        client_id: selectedClientId,
        url: urlInput.trim(),
        slug: slugInput.trim() || undefined,
        custom_domain: customDomainInput.trim() || undefined,
        premium_features: Array.from(selectedPremiumFeatures),
      });
      setResult({ ...data, exact_clone: true });
      setStep('done');
      await loadBrief(selectedClientId);
    } catch (err: any) {
      setImportError(err.message || 'Exact clone failed. Please try again.');
      setStep('configure');
    }
  };

  // ── Publish toggle ─────────────────────────────────────────────────────────
  const handleTogglePublish = async () => {
    if (!brief) return;
    setIsTogglingPublish(true);
    try {
      await AdminService.updateWebsitePublish(selectedClientId, !brief.is_published);
      setBrief(prev => prev ? { ...prev, is_published: !prev.is_published } : null);
    } catch { /* ignore */ }
    setIsTogglingPublish(false);
  };

  const copyUrl = () => {
    if (!result?.client_slug) return;
    navigator.clipboard.writeText(`${window.location.origin}/site/${result.client_slug}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const previewUrl = result?.client_slug ? `/site/${result.client_slug}` : null;

  // ── Static site upload logic ───────────────────────────────────────────────

  const selectedStaticClient = clients.find(c => c.id === staticClientId);

  const handleStaticZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setStaticIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.zip') || file.type === 'application/zip')) {
      setStaticZipFile(file);
      setStaticError(null);
      setStaticSuccess(null);
    }
  };

  const uploadStaticSite = async () => {
    if (!staticClientId || !staticZipFile) return;
    const client = clients.find(c => c.id === staticClientId);
    if (!client) return;

    // Derive slug from existing brief or from business name
    const { data: existingBrief } = await supabase
      .from('website_briefs')
      .select('client_slug')
      .eq('client_id', staticClientId)
      .maybeSingle();

    const clientSlug = existingBrief?.client_slug ||
      client.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    setStaticUploading(true);
    setStaticError(null);
    setStaticSuccess(null);
    setStaticProgress(0);
    setStaticTotal(0);

    try {
      const zip = await JSZip.loadAsync(staticZipFile);
      const files = Object.keys(zip.files).filter(name => !zip.files[name].dir);
      setStaticTotal(files.length);

      let uploaded = 0;
      for (const name of files) {
        const content = await zip.files[name].async('blob');
        // Strip root folder from path if present (dist/index.html → index.html)
        const cleanPath = name.replace(/^[^/]+\//, '');
        const storagePath = `${clientSlug}/${cleanPath}`;

        const { error: uploadErr } = await supabase.storage
          .from('static-sites')
          .upload(storagePath, content, { upsert: true });

        if (uploadErr) throw new Error(`Upload failed for ${cleanPath}: ${uploadErr.message}`);

        uploaded++;
        setStaticProgress(uploaded);
      }

      // Upsert the website_briefs row
      const updatePayload: Record<string, any> = {
        site_type: 'static',
        static_dist_path: `${clientSlug}/`,
        is_published: true,
        client_slug: clientSlug,
      };
      if (staticDomain.trim()) updatePayload.custom_domain = staticDomain.trim();

      const { data: existing } = await supabase
        .from('website_briefs')
        .select('id')
        .eq('client_id', staticClientId)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from('website_briefs').update(updatePayload).eq('client_id', staticClientId);
      } else {
        await supabase.from('website_briefs').insert({
          client_id: staticClientId,
          business_name: client.business_name,
          industry: '',
          services_offered: '',
          location: '',
          tone: 'Professional',
          primary_color: '#4F46E5',
          generation_status: 'complete',
          ...updatePayload,
        });
      }

      const liveUrl = staticDomain.trim()
        ? `https://${staticDomain.trim()}`
        : `${window.location.origin}/site/${clientSlug}`;
      setStaticSuccess(liveUrl);
    } catch (err: any) {
      setStaticError(err.message || 'Upload failed');
    } finally {
      setStaticUploading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Download className="w-8 h-8 text-indigo-600" />
            Site Import
          </h1>
          <p className="text-slate-500 mt-1">
            Migrate any existing website into CWP. Point to a live URL, paste a GitHub repository link, or upload a ZIP export — your chosen AI provider extracts the content and rebuilds it in the CWP format with exact design fidelity.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setMainTab('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainTab === 'import'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            AI Site Import
          </button>
          <button
            onClick={() => setMainTab('static-upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainTab === 'static-upload'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            Upload Static Site
          </button>
        </div>

        {/* ═══ STATIC UPLOAD TAB ════════════════════════════════════════════ */}
        {mainTab === 'static-upload' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800 flex gap-3">
              <Zap className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <strong>Static Site Hosting</strong> — Upload a pre-built <code>/dist</code> ZIP and serve it pixel-perfect on a custom domain with SSL. Zero changes to the original site's look or functionality. Lead capture goes to <code>static_site_leads</code>.
              </div>
            </div>

            {/* Client selector */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">1. Select Client</h2>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={staticClientId}
                onChange={e => { setStaticClientId(e.target.value); setStaticSuccess(null); setStaticError(null); }}
                disabled={staticUploading || loadingClients}
              >
                <option value="">Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.business_name}</option>
                ))}
              </select>

              {/* Custom domain */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Custom Domain <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="cassandrasmith.com"
                    value={staticDomain}
                    onChange={e => setStaticDomain(e.target.value)}
                    disabled={staticUploading}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Point domain DNS to Vercel after upload. Leave blank to use the CWP preview URL.</p>
              </div>
            </div>

            {/* ZIP drop zone */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">2. Upload Built /dist ZIP</h2>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  staticIsDragging
                    ? 'border-indigo-400 bg-indigo-50'
                    : staticZipFile
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
                }`}
                onDragOver={e => { e.preventDefault(); setStaticIsDragging(true); }}
                onDragLeave={() => setStaticIsDragging(false)}
                onDrop={handleStaticZipDrop}
                onClick={() => !staticUploading && staticZipRef.current?.click()}
              >
                {staticZipFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileArchive className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-700">{staticZipFile.name}</p>
                    <p className="text-xs text-slate-400">{(staticZipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    {!staticUploading && (
                      <button
                        className="text-xs text-slate-500 underline"
                        onClick={e => { e.stopPropagation(); setStaticZipFile(null); setStaticSuccess(null); }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Upload className="w-8 h-8" />
                    <p className="text-sm font-semibold">Drag & drop your dist.zip here</p>
                    <p className="text-xs">or click to browse</p>
                  </div>
                )}
                <input
                  ref={staticZipRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setStaticZipFile(f); setStaticError(null); setStaticSuccess(null); }
                  }}
                />
              </div>
            </div>

            {/* Progress */}
            {staticUploading && staticTotal > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex justify-between text-sm text-slate-700">
                  <span className="font-semibold flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading files…
                  </span>
                  <span className="text-slate-500">{staticProgress} / {staticTotal}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.round((staticProgress / staticTotal) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {staticError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {staticError}
              </div>
            )}

            {/* Success */}
            {staticSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Site uploaded &amp; activated!
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={staticSuccess}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 underline break-all"
                  >
                    {staticSuccess}
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(staticSuccess)}
                    className="p-1.5 rounded border border-slate-200 hover:bg-slate-50"
                    title="Copy URL"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
                {staticDomain && (
                  <p className="text-xs text-slate-500">Point <strong>{staticDomain}</strong> DNS to Vercel's IP to activate SSL on the custom domain.</p>
                )}
              </div>
            )}

            {/* Upload button */}
            <button
              disabled={!staticClientId || !staticZipFile || staticUploading}
              onClick={uploadStaticSite}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              {staticUploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              ) : (
                <><CloudUpload className="w-4 h-4" /> Upload &amp; Activate</>
              )}
            </button>
          </div>
        )}

        {/* ═══ IMPORT TAB ══════════════════════════════════════════════════════ */}
        {mainTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Configuration ───────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Client selector (always visible) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Assign to Client
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                disabled={loadingClients || step === 'importing'}
              >
                <option value="">Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.business_name}</option>
                ))}
              </select>
              {brief?.generation_status === 'complete' && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  This client already has a website. Importing will overwrite it.
                </p>
              )}
            </div>

            {/* Import Source card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection('source')}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-slate-900">Import Source</h2>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openSections.source ? '' : '-rotate-90'}`} />
              </button>

              {openSections.source && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                  {/* Tabs */}
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-5">
                    {(['url', 'github', 'zip'] as ImportSource[]).map(src => (
                      <button
                        key={src}
                        onClick={() => { setImportSource(src); setImportError(null); }}
                        disabled={step === 'importing'}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                          importSource === src
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {src === 'url'
                          ? <><Globe className="w-3.5 h-3.5" /> Live URL</>
                          : src === 'github'
                          ? <><Github className="w-3.5 h-3.5" /> GitHub</>
                          : <><FileArchive className="w-3.5 h-3.5" /> Upload ZIP</>
                        }
                      </button>
                    ))}
                  </div>

                  {/* URL input */}
                  {importSource === 'url' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Website URL
                      </label>
                      <input
                        type="url"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        placeholder="https://clientsite.com"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        disabled={step === 'importing'}
                      />
                      <p className="text-xs text-slate-400 mt-2">
                        CWP will crawl the main page and up to 4 sub-pages (about, services, contact, etc.) to extract content. Works with any live website — Hostinger, Squarespace, Wix, etc.
                      </p>
                    </div>
                  )}

                  {/* GitHub input */}
                  {importSource === 'github' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        GitHub Repository URL
                      </label>
                      <input
                        type="url"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        placeholder="https://github.com/owner/repository"
                        value={githubUrlInput}
                        onChange={e => setGithubUrlInput(e.target.value)}
                        disabled={step === 'importing'}
                      />
                      <p className="text-xs text-slate-400 mt-2">
                        Paste the public GitHub repository URL. CWP downloads the ZIP automatically and extracts HTML files. Supports{' '}
                        <span className="font-medium text-slate-500">main</span> and{' '}
                        <span className="font-medium text-slate-500">master</span> branches, or specify a branch via{' '}
                        <span className="font-mono text-slate-500">/tree/branch-name</span> in the URL.
                      </p>
                    </div>
                  )}

                  {/* ZIP input */}
                  {importSource === 'zip' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        ZIP Archive
                      </label>
                      <div
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={onDrop}
                        onClick={() => zipInputRef.current?.click()}
                        className={`w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                          isDragging
                            ? 'border-indigo-400 bg-indigo-50'
                            : zipFile
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                        }`}
                      >
                        {zipFile ? (
                          <>
                            <CheckCircle className="w-6 h-6 text-emerald-500" />
                            <p className="text-sm font-medium text-emerald-700">{zipFile.name}</p>
                            <p className="text-xs text-emerald-600">
                              {(zipFile.size / 1024 / 1024).toFixed(2)} MB — click to change
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-slate-400" />
                            <p className="text-sm text-slate-600 font-medium">Drop ZIP here or click to browse</p>
                            <p className="text-xs text-slate-400">HTML/CSS/JS export from any site builder or file manager</p>
                          </>
                        )}
                      </div>
                      <input
                        ref={zipInputRef}
                        type="file"
                        accept=".zip,application/zip"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setZipFile(f);
                          e.target.value = '';
                        }}
                      />
                      <p className="text-xs text-slate-400 mt-2">
                        Export your site as a ZIP from Hostinger File Manager, GitHub (Download ZIP), or any hosting provider. HTML files inside will be parsed automatically.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Site Config card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection('config')}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-slate-900">Site Configuration</h2>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openSections.config ? '' : '-rotate-90'}`} />
              </button>

              {openSections.config && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Site Slug <span className="text-slate-400 font-normal">(optional — auto-generated)</span>
                    </label>
                    <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                      <span className="px-3 py-2 bg-slate-50 text-slate-400 text-xs border-r border-slate-300 whitespace-nowrap">/site/</span>
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 text-sm focus:outline-none font-mono"
                        placeholder="acme-plumbing"
                        value={slugInput}
                        onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        disabled={step === 'importing'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Custom Domain <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="www.clientsite.com"
                      value={customDomainInput}
                      onChange={e => setCustomDomainInput(e.target.value.trim().toLowerCase())}
                      disabled={step === 'importing'}
                    />
                  </div>

                  {/* AI Provider selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      AI Provider
                    </label>
                    <select
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedProvider}
                      onChange={e => setSelectedProvider(e.target.value)}
                      disabled={step === 'importing'}
                    >
                      {AI_PROVIDER_OPTIONS.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.label}{p.badge ? ` — ${p.badge}` : ''}
                        </option>
                      ))}
                    </select>
                    {/* Description of selected provider */}
                    {(() => {
                      const opt = getProviderOption(selectedProvider);
                      return opt ? (
                        <div className="mt-2 flex items-center gap-2">
                          {opt.badge && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${opt.badgeColor}`}>
                              {opt.badge}
                            </span>
                          )}
                          <p className="text-xs text-slate-400">{opt.description}</p>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Brand Tone</label>
                    <select
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={toneInput}
                      onChange={e => setToneInput(e.target.value as any)}
                      disabled={step === 'importing'}
                    >
                      {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      Tone guidance passed to the AI when regenerating copy.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Primary Brand Color
                    </label>
                    {/* Override toggle */}
                    <button
                      type="button"
                      onClick={() => setOverridePrimaryColor(p => !p)}
                      disabled={step === 'importing'}
                      className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors mb-3 ${
                        overridePrimaryColor
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {overridePrimaryColor
                        ? <><Check className="w-3.5 h-3.5" /> Override color</>
                        : <><X className="w-3.5 h-3.5" /> Auto-detect color</>
                      }
                    </button>
                    {overridePrimaryColor ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer"
                          value={primaryColorInput}
                          onChange={e => setPrimaryColorInput(e.target.value)}
                          disabled={step === 'importing'}
                        />
                        <span className="text-sm text-slate-500 font-mono">{primaryColorInput}</span>
                        <button
                          onClick={() => setPrimaryColorInput('#4F46E5')}
                          className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          Reset
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        The AI will auto-detect the brand color from the imported site. Enable the override above to force a specific color instead.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Premium Features card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection('features')}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-slate-900">Premium Features</h2>
                  {selectedPremiumFeatures.size > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{selectedPremiumFeatures.size} on</span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openSections.features ? '' : '-rotate-90'}`} />
              </button>

              {openSections.features && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400 mb-5">
                    Select features to enable on the imported site.
                  </p>
                  <div className="space-y-5">
                    {PREMIUM_FEATURE_GROUPS.map(group => {
                      const featuresInGroup = PREMIUM_FEATURE_OPTIONS.filter(f => f.group === group);
                      const selectedInGroup = featuresInGroup.filter(f => selectedPremiumFeatures.has(f.id)).length;
                      return (
                        <div key={group}>
                          <button
                            type="button"
                            onClick={() => toggleFeatureGroup(group)}
                            className="w-full flex items-center gap-2 mb-2 hover:opacity-80 transition-opacity"
                          >
                            <span className="text-slate-400">{PREMIUM_GROUP_ICONS[group]}</span>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group}</span>
                            {selectedInGroup > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                                {selectedInGroup} on
                              </span>
                            )}
                            <ChevronDown className={`ml-auto w-3.5 h-3.5 text-slate-400 transition-transform ${collapsedFeatureGroups[group] ? '-rotate-90' : ''}`} />
                          </button>
                          {!collapsedFeatureGroups[group] && (
                            <div className="space-y-2">
                              {featuresInGroup.map(feature => {
                                const isSelected = selectedPremiumFeatures.has(feature.id);
                                return (
                                  <button
                                    key={feature.id}
                                    type="button"
                                    onClick={() => togglePremiumFeature(feature.id)}
                                    disabled={step === 'importing'}
                                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                                      isSelected
                                        ? 'border-amber-300 bg-amber-50'
                                        : 'border-slate-200 bg-white hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 mt-0.5 ${
                                      isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'
                                    }`}>
                                      {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-sm font-medium ${isSelected ? 'text-amber-800' : 'text-slate-700'}`}>
                                          {feature.name}
                                        </span>
                                        {feature.badge && (
                                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                            feature.badge === 'Popular' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
                                          }`}>{feature.badge}</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{feature.description}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Import buttons */}
            <div className="space-y-2">
              {importSource === 'url' && (
                <button
                  onClick={handleExactClone}
                  disabled={!canImport || step === 'importing'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {step === 'importing' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Cloning...</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Exact Clone — Pixel Perfect</>
                  )}
                </button>
              )}
              {importSource === 'url' && (
                <p className="text-xs text-center text-slate-400">
                  ↑ Preserves exact design from Hostinger/any host — no AI rewrite
                </p>
              )}
              <button
                onClick={handleImport}
                disabled={!canImport || step === 'importing'}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {step === 'importing' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing site...</>
                ) : (
                  <><Download className="w-4 h-4" /> Import &amp; Rebuild with AI</>
                )}
              </button>
              {importSource === 'url' && (
                <p className="text-xs text-center text-slate-400">
                  ↑ AI rebuilds as editable CWP sections — design may differ from original
                </p>
              )}
            </div>
          </div>

          {/* ── Right: Output ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Importing progress */}
            {step === 'importing' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-5">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                  <p className="text-slate-700 font-semibold text-lg">Importing your site...</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Using {getProviderOption(selectedProvider)?.label || 'AI'}
                  </p>
                  <div className="mt-6 space-y-2 text-left w-full max-w-sm mx-auto">
                    {[
                      importSource === 'url' ? 'Crawling pages & CSS...' : importSource === 'github' ? 'Fetching GitHub repository...' : 'Extracting ZIP contents...',
                      'Parsing HTML structure & inline styles...',
                      'Extracting full color palette, fonts & layout...',
                      `${getProviderOption(selectedProvider)?.label || 'AI'} mapping to CWP format...`,
                      'Saving to database...',
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-slate-500">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                        </div>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Autonomous provisioning panel — appears if Claude is provisioning infrastructure */}
                {showProvisioningPanel && (
                  <ProvisioningProgress
                    steps={provisioningSteps}
                    aiProviderLabel={getProviderOption(selectedProvider)?.label}
                    isActive={isImporting}
                  />
                )}
              </div>
            )}

            {/* Post-import provisioning panel (if resources were created) */}
            {step !== 'importing' && showProvisioningPanel && provisioningSteps.length > 0 && (
              <ProvisioningProgress
                steps={provisioningSteps}
                aiProviderLabel={getProviderOption(selectedProvider)?.label}
                isActive={false}
                onDismiss={() => setShowProvisioningPanel(false)}
              />
            )}

            {/* Error state */}
            {importError && step === 'configure' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Import failed</p>
                    <p className="text-red-600 text-sm mt-1">{importError}</p>
                    <button onClick={() => setImportError(null)} className="mt-3 text-sm text-red-700 underline">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Idle / no client state */}
            {step === 'configure' && !importError && !result && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <Download className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-600 font-medium">Ready to import</p>
                <p className="text-slate-400 text-sm mt-1 max-w-sm">
                  Select a client, choose your import source (URL or ZIP), configure the site settings, then click Import Site.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md text-left">
                  {[
                    { icon: <Link className="w-4 h-4 text-emerald-500" />, title: 'Live Website URL', text: 'Paste any public URL — Hostinger, Squarespace, Wix, etc. CWP crawls pages automatically' },
                    { icon: <Github className="w-4 h-4 text-slate-700" />, title: 'GitHub Repository', text: 'Paste a github.com repo URL — CWP downloads and extracts the ZIP automatically' },
                    { icon: <FileArchive className="w-4 h-4 text-amber-500" />, title: 'ZIP Upload', text: 'Export from Hostinger File Manager, download from GitHub, or export from WordPress' },
                    { icon: <Code2 className="w-4 h-4 text-purple-500" />, title: 'Static Build Output', text: 'Angular / React / Vue / Next.js — ZIP the dist/ or build/ folder and upload' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        {item.icon}
                        <span className="text-xs font-semibold text-slate-700">{item.title}</span>
                      </div>
                      <p className="text-xs text-slate-400">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Result: Done ─────────────────────────────────────────────── */}
            {step === 'done' && result && (
              <>
                {/* Actions bar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-slate-800">{result.business_name}</span>
                    {statusBadge('complete')}
                  </div>
                  <span className="text-sm text-slate-500 font-mono">/site/{result.client_slug}</span>
                  <div className="flex items-center gap-2 ml-auto flex-wrap">
                    {brief && (
                      <button
                        onClick={handleTogglePublish}
                        disabled={isTogglingPublish}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                        style={
                          brief.is_published
                            ? { borderColor: '#10b981', color: '#059669', backgroundColor: '#f0fdf4' }
                            : { borderColor: '#e2e8f0', color: '#64748b', backgroundColor: '#f8fafc' }
                        }
                      >
                        {brief.is_published
                          ? <><ToggleRight className="w-4 h-4" /> Published</>
                          : <><ToggleLeft className="w-4 h-4" /> Draft</>
                        }
                      </button>
                    )}
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
                      {copiedUrl
                        ? <><CheckCircle className="w-4 h-4 text-emerald-500" /> Copied!</>
                        : <><Copy className="w-4 h-4" /> Copy URL</>
                      }
                    </button>
                  </div>
                </div>

                {/* Stats bar */}
                <div className={`border rounded-2xl p-5 grid grid-cols-3 gap-4 ${result.exact_clone ? 'bg-emerald-50 border-emerald-100' : 'bg-indigo-50 border-indigo-100'}`}>
                  {result.exact_clone ? (
                    <>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-700">{result.html_size_kb ?? '—'}KB</p>
                        <p className="text-xs text-emerald-500 mt-0.5">HTML preserved</p>
                      </div>
                      <div className="text-center border-x border-emerald-200">
                        <p className="text-2xl font-bold text-emerald-700">100%</p>
                        <p className="text-xs text-emerald-500 mt-0.5">Pixel fidelity</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-700">✓</p>
                        <p className="text-xs text-emerald-500 mt-0.5">CSS inlined</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-indigo-700">{result.pages_imported}</p>
                        <p className="text-xs text-indigo-500 mt-0.5">Pages imported</p>
                      </div>
                      <div className="text-center border-x border-indigo-200">
                        <p className="text-2xl font-bold text-indigo-700">
                          {result.website_json?.pages?.reduce((n: number, p: any) => n + (p.sections?.length || 0), 0) || 0}
                        </p>
                        <p className="text-xs text-indigo-500 mt-0.5">Sections built</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-indigo-700">{result.backend_features?.length ?? 0}</p>
                        <p className="text-xs text-indigo-500 mt-0.5">Backend features detected</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Global settings */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wide">Global Settings</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-600">
                    <span><span className="font-medium text-slate-700">Business:</span> {result.website_json?.global?.business_name}</span>
                    <span><span className="font-medium text-slate-700">Font:</span> {result.website_json?.global?.font_heading}</span>
                    <span>
                      <span className="font-medium text-slate-700">Color:</span>{' '}
                      {result.website_json?.global?.primary_color && (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block w-3 h-3 rounded-full border border-slate-300"
                            style={{ backgroundColor: result.website_json.global.primary_color }}
                          />
                          {result.website_json.global.primary_color}
                        </span>
                      )}
                    </span>
                    <span><span className="font-medium text-slate-700">Phone:</span> {result.website_json?.global?.phone || '—'}</span>
                    <span className="col-span-2"><span className="font-medium text-slate-700">Address:</span> {result.website_json?.global?.address || '—'}</span>
                    <span className="col-span-2">
                      <span className="font-medium text-slate-700">AI Provider:</span>{' '}
                      {getProviderOption(selectedProvider)?.label || selectedProvider}
                    </span>
                  </div>
                </div>

                {/* Custom Domain */}
                {customDomainInput && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Link className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Custom Domain</h3>
                      <span className="ml-auto text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {customDomainInput}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowDnsInstructions(o => !o)}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
                    >
                      <Info className="w-3.5 h-3.5" />
                      {showDnsInstructions ? 'Hide' : 'Show'} DNS setup instructions
                    </button>
                    {showDnsInstructions && (
                      <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-3">
                        <p className="font-semibold text-slate-700">DNS setup at Hostinger / domain registrar</p>
                        <ol className="space-y-2 list-decimal list-inside">
                          <li>Log in to Hostinger (or the domain registrar) and go to <strong>DNS / Zone Editor</strong>.</li>
                          <li>Add a <strong>CNAME record</strong>:
                            <div className="mt-1 font-mono bg-white border border-slate-200 rounded p-2 text-xs">
                              <div>Host: <strong>www</strong></div>
                              <div>Value: <strong>cname.vercel-dns.com</strong></div>
                            </div>
                          </li>
                          <li>For the root domain, add an <strong>A record</strong>:
                            <div className="mt-1 font-mono bg-white border border-slate-200 rounded p-2 text-xs">
                              <div>Host: <strong>@</strong></div>
                              <div>Value: <strong>76.76.21.21</strong></div>
                            </div>
                          </li>
                          <li>In <strong>Vercel → Domains</strong>, add the client's domain. SSL is auto-provisioned.</li>
                          <li>DNS propagation: up to <strong>24–48 hours</strong>.</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {/* Pages accordion */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      Imported Pages <span className="text-slate-400 font-normal">({result.website_json?.pages?.length})</span>
                    </h3>
                    <span className="text-xs text-slate-400">Click to expand sections</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(result.website_json?.pages || []).map((page: any) => {
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
                            <span className="text-xs text-slate-400 mr-2">{page.sections?.length} sections</span>
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-slate-400" />
                              : <ChevronRight className="w-4 h-4 text-slate-400" />
                            }
                          </button>
                          {isExpanded && (
                            <div className="px-5 pb-4 bg-slate-50">
                              <div className="mb-3 p-3 bg-white rounded-xl border border-slate-100 text-xs">
                                <p className="font-medium text-slate-600 mb-1">SEO</p>
                                <p className="text-slate-800 font-medium">{page.seo?.title}</p>
                                <p className="text-slate-500 mt-0.5">{page.seo?.meta_description}</p>
                              </div>
                              <div className="space-y-2">
                                {(page.sections || []).map((section: any, si: number) => (
                                  <div key={si} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                                    <span className="text-xs font-mono bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded mt-0.5 flex-shrink-0">
                                      {section.section_type}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-slate-600">
                                        Variant: <span className="font-medium text-slate-800">{section.variant}</span>
                                      </p>
                                      {section.editable_fields?.length > 0 && (
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

                {/* Backend migration notes */}
                {result.backend_features.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-amber-200 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-amber-600" />
                      <h3 className="font-semibold text-amber-900 text-sm">
                        Backend Migration Required
                      </h3>
                      <span className="ml-auto text-xs bg-amber-200 text-amber-800 font-medium px-2 py-0.5 rounded-full">
                        {result.backend_features.length} feature{result.backend_features.length !== 1 ? 's' : ''} detected
                      </span>
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-amber-700 mb-4">
                        CWP serves static-style sites with Supabase Edge Functions handling dynamic backend logic.
                        The following features from the original site need to be reconnected:
                      </p>
                      <div className="space-y-3">
                        {result.backend_features.map(feature => {
                          const info = BACKEND_FEATURE_LABELS[feature] || {
                            label: feature,
                            action: 'Evaluate whether this feature is needed and implement via a Supabase Edge Function.',
                            icon: <Code2 className="w-4 h-4 text-slate-500" />,
                          };
                          return (
                            <div key={feature} className="flex items-start gap-3 p-3 bg-white border border-amber-200 rounded-xl">
                              <div className="flex-shrink-0 mt-0.5">{info.icon}</div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{info.label}</p>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{info.action}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 p-3 bg-white border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-amber-500" />
                          General Migration Notes (Express / NestJS)
                        </p>
                        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                          <li>Each Express/NestJS route becomes a <code className="bg-slate-100 px-1 rounded">supabase/functions/&lt;name&gt;/index.ts</code> edge function.</li>
                          <li>Environment variables (API keys, DB URLs) move to Supabase project Secrets.</li>
                          <li>Database models map to Supabase Postgres tables with Row Level Security.</li>
                          <li>File uploads use Supabase Storage (replace multer/disk storage).</li>
                          <li>Email sending uses the existing <code className="bg-slate-100 px-1 rounded">send-email</code> edge function.</li>
                          <li>Sessions/JWT auth is handled by <code className="bg-slate-100 px-1 rounded">supabase.auth</code> — remove Passport.js / custom middleware.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Next steps */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-indigo-500" />
                    Next Steps
                  </h3>
                  <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                    <li>
                      <a href="/admin/website-builder" className="text-indigo-600 hover:underline font-medium">
                        Open Website Builder
                      </a>{' '}
                      to fine-tune copy, swap section variants, and upload logo/hero images.
                    </li>
                    <li>Toggle the site to <strong>Published</strong> above when it's ready to go live.</li>
                    {customDomainInput && (
                      <li>Configure DNS records at Hostinger to point <code className="bg-slate-50 px-1 rounded">{customDomainInput}</code> to Vercel.</li>
                    )}
                    {result.backend_features.length > 0 && (
                      <li>Reconnect the {result.backend_features.length} detected backend feature{result.backend_features.length !== 1 ? 's' : ''} listed above.</li>
                    )}
                    <li>Share the preview link with the client for review.</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSiteImport;
