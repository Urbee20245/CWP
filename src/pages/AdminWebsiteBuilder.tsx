"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import {
  Globe, Loader2, AlertTriangle, CheckCircle, Eye, Copy, EyeOff,
  RefreshCw, Wand2, ChevronDown, FileText, Check, Link, Save, Info, Key,
  Sparkles, Send, ExternalLink, Settings, ToggleLeft, ToggleRight, X,
  MessageSquare, ChevronRight, Zap, Image, Link2, Upload, Bot,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import {
  WebsiteBrief, GenerationStatus, ALL_PAGE_OPTIONS, PageId,
} from '../types/website';
import WebsiteMediaPanel from '../components/WebsiteMediaPanel';
import { AI_PROVIDER_OPTIONS, DEFAULT_PROVIDER_ID, getProviderOption } from '../constants/aiProviders';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  business_name: string;
  billing_email: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

type LeftPanelState = 'type-picker' | 'brief-form' | 'clone' | 'generating' | 'chat';
type CloneMode = 'url' | 'image';
type RightView = 'build' | 'pages' | 'media';

// ─── Constants ───────────────────────────────────────────────────────────────

const WEBSITE_TYPES = [
  { emoji: '🏪', label: 'Local Business',       desc: 'Shops, services, trades',       industry: 'Local Business' },
  { emoji: '🍕', label: 'Restaurant',           desc: 'Food, cafe, catering',          industry: 'Restaurant & Food' },
  { emoji: '🏥', label: 'Medical',              desc: 'Clinics, dental, wellness',     industry: 'Medical & Healthcare' },
  { emoji: '🏠', label: 'Real Estate',          desc: 'Agents, property, rentals',     industry: 'Real Estate' },
  { emoji: '🛒', label: 'E-Commerce',           desc: 'Online store, products',        industry: 'E-Commerce' },
  { emoji: '💼', label: 'Professional Services',desc: 'Legal, accounting, consulting', industry: 'Professional Services' },
  { emoji: '💅', label: 'Beauty & Wellness',    desc: 'Salon, spa, fitness',           industry: 'Beauty & Wellness' },
  { emoji: '🎨', label: 'Portfolio/Creative',   desc: 'Design, photography, art',      industry: 'Creative Portfolio' },
  { emoji: '❤️', label: 'Nonprofit',            desc: 'Charities, foundations',        industry: 'Nonprofit' },
  { emoji: '💻', label: 'Tech/SaaS',            desc: 'Software, apps, startups',      industry: 'Tech & SaaS' },
  { emoji: '📚', label: 'Education/Coaching',   desc: 'Courses, tutoring, coaching',   industry: 'Education & Coaching' },
  { emoji: '⚡', label: 'Custom/Other',         desc: 'Something unique',              industry: '' },
];

const TONES = ['Professional', 'Friendly', 'Bold', 'Luxurious'] as const;

const QUICK_PROMPTS = [
  'Make it more modern',
  'Add a pricing section',
  'Change hero to dark background',
  'Add FAQ section',
  'Make it more minimalist',
  'Add testimonials',
];

const REGEN_REGEX = /regenerat|rebuild|start over|new site|redo/i;

// ─── Helper: normalise brief row to handle old + new column names ─────────────

function normaliseBrief(data: any): WebsiteBrief {
  return {
    ...data,
    business_name:     data.business_name     ?? '',
    services_offered:  data.services_offered  ?? data.services              ?? '',
    primary_color:     data.primary_color     ?? data.brand_color           ?? '#4F46E5',
    art_direction:     data.art_direction     ?? data.art_direction_notes   ?? '',
    generation_status: (data.generation_status
      ?? (data.is_generation_complete ? 'complete' : 'draft')) as GenerationStatus,
    client_slug:       data.client_slug       ?? data.slug                  ?? null,
  } as WebsiteBrief;
}

// ─── Component ───────────────────────────────────────────────────────────────

const AdminWebsiteBuilder: React.FC = () => {
  // Clients
  const [clients, setClients]               = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('');

  // Brief & generation
  const [brief, setBrief]           = useState<WebsiteBrief | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError]     = useState<string | null>(null);

  // Left panel state machine
  const [panelState, setPanelState] = useState<LeftPanelState>('type-picker');

  // Right panel view
  const [rightView, setRightView]   = useState<RightView>('build');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const [activePreviewPageSlug, setActivePreviewPageSlug] = useState<string>('');

  // Form
  const [form, setForm] = useState({
    business_name:   '',
    industry:        '',
    location:        '',
    services_offered:'',
    tone:            'Professional' as typeof TONES[number],
    primary_color:   '#4F46E5',
    art_direction:   '',
  });

  // Pages
  const [selectedPages, setSelectedPages] = useState<Set<PageId>>(
    new Set(['home', 'about', 'services', 'contact'])
  );

  // Chat
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]     = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatProvider, setChatProvider] = useState(DEFAULT_PROVIDER_ID);
  const chatEndRef                    = useRef<HTMLDivElement>(null);
  const chatInputRef                  = useRef<HTMLTextAreaElement>(null);

  // Clone
  const [generatingLabel, setGeneratingLabel] = useState('Building your website...');
  const [cloneMode, setCloneMode] = useState<CloneMode>('url');
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneImage, setCloneImage] = useState<File | null>(null);
  const [cloneImagePreview, setCloneImagePreview] = useState<string | null>(null);
  const [cloneForm, setCloneForm] = useState({
    business_name: '',
    industry: '',
    location: '',
    services_offered: '',
    tone: 'Professional' as typeof TONES[number],
    primary_color: '#4F46E5',
  });
  const [cloneError, setCloneError] = useState<string | null>(null);
  const cloneFileInputRef = useRef<HTMLInputElement>(null);

  // Re-clone
  const [showReclonePanel, setShowReclonePanel] = useState(false);
  const [recloneMode, setRecloneMode] = useState<'url' | 'image'>('url');
  const [recloneUrl, setRecloneUrl] = useState('');
  const [recloneImage, setRecloneImage] = useState<File | null>(null);
  const [recloneImagePreview, setRecloneImagePreview] = useState<string | null>(null);
  const [recloneError, setRecloneError] = useState<string | null>(null);
  const [isRecloning, setIsRecloning] = useState(false);

  // Publish
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);

  // Copy URL
  const [copied, setCopied] = useState(false);

  // Settings — custom domain
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [savingDomain, setSavingDomain]   = useState(false);
  const [domainSaved, setDomainSaved]     = useState(false);
  const [domainError, setDomainError]     = useState<string | null>(null);
  const [showDnsInstructions, setShowDnsInstructions] = useState(false);

  // Settings — registrar creds
  const [domainCreds, setDomainCreds] = useState<{
    registrar_name: string; login_url: string;
    username: string; password: string; notes: string;
  } | null>(null);
  const [showPassword, setShowPassword]   = useState(false);
  const [copiedField, setCopiedField]     = useState<string | null>(null);

  // Settings — edit-brief within settings panel
  const [settingsForm, setSettingsForm] = useState({ ...form });

  // AI provider selection
  const [selectedProvider, setSelectedProvider] = useState(DEFAULT_PROVIDER_ID);

  // ── Load clients ─────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, business_name, billing_email')
      .order('business_name')
      .then(({ data }) => {
        setClients(data || []);
        setLoadingClients(false);
      });
  }, []);

  // ── Load brief ───────────────────────────────────────────────────────────

  const loadBrief = useCallback(async (clientId: string): Promise<ReturnType<typeof normaliseBrief> | null> => {
    if (!clientId) return null;
    setLoadingBrief(true);
    setGenError(null);

    const { data } = await supabase
      .from('website_briefs')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (data) {
      const nb = normaliseBrief(data);
      setBrief(nb);

      const nextForm = {
        business_name:    nb.business_name   || '',
        industry:         nb.industry        || '',
        location:         nb.location        || '',
        services_offered: nb.services_offered || '',
        tone:             (nb.tone as typeof TONES[number]) || 'Professional',
        primary_color:    nb.primary_color   || '#4F46E5',
        art_direction:    nb.art_direction   || '',
      };
      setForm(nextForm);
      setSettingsForm(nextForm);

      if (nb.website_json?.pages) {
        setSelectedPages(new Set(nb.website_json.pages.map((p: any) => p.id as PageId)));
      }

      setCustomDomainInput(nb.custom_domain || '');

      // Restore the provider that was last used for this site
      if (nb.ai_provider) {
        setSelectedProvider(nb.ai_provider);
      }

      // Determine panel state from brief
      if (nb.generation_status === 'complete' && nb.website_json) {
        setPanelState('chat');
        setRightView('build');
        setActivePreviewPageSlug('');
      } else if (nb.generation_status === 'error') {
        setPanelState('brief-form');
        setGenError(nb.generation_error || 'Generation failed. Please try again.');
      } else if (nb.generation_status === 'generating') {
        setPanelState('generating');
      } else {
        // draft — skip type picker, go straight to form
        setPanelState('brief-form');
      }
    } else {
      setBrief(null);
      setCustomDomainInput('');
      const client = clients.find(c => c.id === clientId);
      setForm(f => ({
        ...f,
        business_name: client?.business_name || '',
        industry: '',
        location: '',
        services_offered: '',
        tone: 'Professional',
        primary_color: '#4F46E5',
        art_direction: '',
      }));
      setPanelState('type-picker');
    }

    // Clear loading now — panelState and brief are both settled.
    // Creds are a secondary fetch that must not delay the panel transition.
    setLoadingBrief(false);

    // Load registrar creds (non-blocking for panel state)
    const { data: credsData } = await supabase
      .from('client_domain_credentials')
      .select('registrar_name, login_url, username, password, notes')
      .eq('client_id', clientId)
      .maybeSingle();

    setDomainCreds(credsData
      ? { registrar_name: credsData.registrar_name, login_url: credsData.login_url,
          username: credsData.username, password: credsData.password, notes: credsData.notes }
      : null);
    setShowPassword(false);
    return data ? normaliseBrief(data) : null;
  }, [clients]);

  useEffect(() => {
    if (selectedClientId) loadBrief(selectedClientId);
  }, [selectedClientId, loadBrief]);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // ── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (overrideForm?: typeof form) => {
    if (!selectedClientId) return;
    const f = overrideForm || form;
    setIsGenerating(true);
    setGenError(null);
    setGeneratingLabel('Building your website...');
    setPanelState('generating');

    try {
      await AdminService.generateWebsite({
        client_id:        selectedClientId,
        business_name:    f.business_name,
        industry:         f.industry,
        services_offered: f.services_offered,
        location:         f.location,
        tone:             f.tone,
        primary_color:    f.primary_color,
        art_direction:    f.art_direction,
        pages_to_generate: Array.from(selectedPages),
        ai_provider:      selectedProvider,
      });
      const loadedBrief = await loadBrief(selectedClientId);
      if (loadedBrief?.generation_status === 'complete' && loadedBrief?.website_json) {
        setPanelState('chat');
      } else {
        const errMsg = loadedBrief?.generation_error || 'Website was not saved. Please try again.';
        setGenError(errMsg);
        setPanelState('brief-form');
      }
    } catch (err: any) {
      setGenError(err.message || 'Generation failed. Please try again.');
      setPanelState('brief-form');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedClientId, form, selectedPages, loadBrief]);

  // ── Clone ─────────────────────────────────────────────────────────────────

  const handleCloneImageChange = (file: File) => {
    setCloneImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setCloneImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleClone = useCallback(async () => {
    if (!selectedClientId) return;
    setCloneError(null);
    setIsGenerating(true);
    setGeneratingLabel(cloneMode === 'image' ? 'Analysing design & cloning...' : 'Scraping site & cloning...');
    setPanelState('generating');

    try {
      if (cloneMode === 'url') {
        if (!cloneUrl.trim()) throw new Error('Please enter a domain or URL to clone.');
        await AdminService.cloneWebsiteFromUrl({
          client_id: selectedClientId,
          url: cloneUrl.trim(),
          tone: form.tone,
          primary_color: form.primary_color !== '#4F46E5' ? form.primary_color : undefined,
        });
      } else {
        if (!cloneImage) throw new Error('Please upload a screenshot image.');
        if (!cloneForm.business_name || !cloneForm.industry || !cloneForm.services_offered || !cloneForm.location) {
          throw new Error('Please fill in all required business fields.');
        }

        // Convert image to base64
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            // Strip the data URL prefix (e.g. "data:image/jpeg;base64,")
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(cloneImage);
        });

        await AdminService.cloneWebsiteFromImage({
          client_id: selectedClientId,
          image_base64: imageBase64,
          image_mime_type: cloneImage.type || 'image/jpeg',
          business_name: cloneForm.business_name,
          industry: cloneForm.industry,
          services_offered: cloneForm.services_offered,
          location: cloneForm.location,
          tone: cloneForm.tone,
          primary_color: cloneForm.primary_color,
          pages_to_generate: Array.from(selectedPages),
        });
      }

      const loadedBrief = await loadBrief(selectedClientId);
      if (loadedBrief?.generation_status === 'complete' && loadedBrief?.website_json) {
        setPanelState('chat');
      } else {
        const errMsg = loadedBrief?.generation_error || 'Website was not saved. Please try again.';
        setCloneError(errMsg);
        setPanelState('clone');
      }
    } catch (err: any) {
      setCloneError(err.message || 'Cloning failed. Please try again.');
      setPanelState('clone');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedClientId, cloneMode, cloneUrl, cloneImage, cloneForm, form, selectedPages, loadBrief]);

  // ── Re-clone ──────────────────────────────────────────────────────────────

  const handleReclone = useCallback(async () => {
    if (!selectedClientId) return;
    setRecloneError(null);
    setIsRecloning(true);
    setIsGenerating(true);
    setGeneratingLabel(recloneMode === 'image' ? 'Analysing design & rebuilding...' : 'Scraping & rebuilding site...');
    setShowReclonePanel(false);
    setPanelState('generating');

    try {
      if (recloneMode === 'url') {
        if (!recloneUrl.trim()) throw new Error('Please enter a domain or URL.');
        await AdminService.cloneWebsiteFromUrl({
          client_id: selectedClientId,
          url: recloneUrl.trim(),
          tone: form.tone,
          primary_color: form.primary_color !== '#4F46E5' ? form.primary_color : undefined,
        });
      } else {
        if (!recloneImage) throw new Error('Please upload a screenshot image.');
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(recloneImage);
        });
        await AdminService.cloneWebsiteFromImage({
          client_id: selectedClientId,
          image_base64: imageBase64,
          image_mime_type: recloneImage.type || 'image/jpeg',
          business_name: brief?.business_name ?? '',
          industry: brief?.industry ?? '',
          services_offered: brief?.services_offered ?? '',
          location: brief?.location ?? '',
          tone: form.tone,
          primary_color: form.primary_color,
          pages_to_generate: Array.from(selectedPages),
        });
      }

      const loadedBrief = await loadBrief(selectedClientId);
      if (loadedBrief?.generation_status === 'complete' && loadedBrief?.website_json) {
        setPanelState('chat');
      } else {
        setRecloneError(loadedBrief?.generation_error || 'Reclone failed. Please try again.');
        setPanelState('chat');
      }
    } catch (err: any) {
      setRecloneError(err.message || 'Reclone failed. Please try again.');
      setPanelState('chat');
    } finally {
      setIsRecloning(false);
      setIsGenerating(false);
    }
  }, [selectedClientId, recloneMode, recloneUrl, recloneImage, brief, form, selectedPages, loadBrief]);

  // ── Publish toggle ────────────────────────────────────────────────────────

  const handleTogglePublish = async () => {
    if (!brief) return;
    setIsTogglingPublish(true);
    try {
      await AdminService.updateWebsitePublish(selectedClientId, !brief.is_published);
      setBrief(prev => prev ? { ...prev, is_published: !prev.is_published } : null);
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setIsTogglingPublish(false);
    }
  };

  // ── Save domain ───────────────────────────────────────────────────────────

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

  // ── Chat send ─────────────────────────────────────────────────────────────

  const handleChatSend = useCallback(async (inputOverride?: string) => {
    const text = (inputOverride ?? chatInput).trim();
    if (!text || isChatLoading) return;

    const userMsg: ChatMessage = { id: `${Date.now()}`, role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    // If it's a regeneration request, call handleGenerate directly
    if (REGEN_REGEX.test(text)) {
      setMessages(prev => [...prev, {
        id: `${Date.now()}a`,
        role: 'assistant',
        content: "Got it! Starting a full regeneration of your website now...",
        ts: Date.now(),
      }]);
      setIsChatLoading(false);
      await handleGenerate();
      return;
    }

    // Otherwise call Supabase edge function
    try {
      const siteInfo = brief ? `
Current site: "${brief.business_name}" (${brief.industry})
Location: ${brief.location}
Services: ${brief.services_offered}
Tone: ${brief.tone}
Color: ${brief.primary_color}
Pages: ${brief.website_json?.pages?.map((p: any) => p.name).join(', ') || 'none'}
Site URL: /site/${brief.client_slug}` : 'No site generated yet.';

      const systemPrompt = `You are an AI web designer assistant helping an agency build and refine client websites.
${siteInfo}

When the user wants a complete website rebuild or regeneration, respond with: REGENERATE: <art_direction_notes>
For all other requests, give helpful, specific advice about design, content, or improvements.
Keep responses concise and actionable. Respond in 1-3 sentences max unless detail is truly needed.`;

      const conversationHistory = [
        ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];

      const { data, error } = await supabase.functions.invoke('website-chat', {
        body: { system: systemPrompt, messages: conversationHistory, provider: chatProvider },
      });
      if (error) throw error;
      const reply = data?.reply || "I couldn't process that request.";

      // Check if AI wants to regenerate with new art direction
      if (reply.startsWith('REGENERATE:')) {
        const newArtDirection = reply.replace('REGENERATE:', '').trim();
        setMessages(prev => [...prev, {
          id: `${Date.now()}b`, role: 'assistant',
          content: `Regenerating with updated direction: "${newArtDirection}"`,
          ts: Date.now(),
        }]);
        setIsChatLoading(false);
        const updatedForm = { ...form, art_direction: newArtDirection };
        setForm(updatedForm);
        await handleGenerate(updatedForm);
        return;
      }

      setMessages(prev => [...prev, { id: `${Date.now()}c`, role: 'assistant', content: reply, ts: Date.now() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `${Date.now()}e`, role: 'assistant',
        content: `Error: ${err.message}`,
        ts: Date.now(),
      }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, messages, brief, form, handleGenerate]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const togglePage = (pageId: PageId) => {
    if (pageId === 'home') return;
    setSelectedPages(prev => {
      const next = new Set(prev);
      next.has(pageId) ? next.delete(pageId) : next.add(pageId);
      return next;
    });
  };

  const copyUrl = () => {
    if (!brief?.client_slug) return;
    navigator.clipboard.writeText(`${window.location.origin}/site/${brief.client_slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyField = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isFormValid = form.business_name && form.industry && form.services_offered && form.location;
  const slug = brief?.client_slug || (brief as any)?.slug;
  const previewUrl  = slug ? `/site/${slug}?preview=1` : null;
  const currentPreviewUrl = slug
    ? (activePreviewPageSlug
        ? `/site/${slug}/${activePreviewPageSlug}?preview=1`
        : `/site/${slug}?preview=1`)
    : null;
  const hasWebsite  = brief?.generation_status === 'complete' && !!brief.website_json;
  const pageCount   = brief?.website_json?.pages?.length ?? 0;
  const isStuckGenerating = brief?.generation_status === 'generating' &&
    !!brief?.updated_at &&
    (Date.now() - new Date(brief.updated_at).getTime()) > 10 * 60 * 1000;

  // ── Derived panel state ───────────────────────────────────────────────────

  // While loading the brief for a freshly-selected client, default to
  // type-picker so there is no stale panel from the previous client.
  // Exception: if we are mid-generation (or in clone flow) the brief is being
  // RE-fetched after the generate call — keep the current panelState so
  // the UI doesn't flicker back to 'type-picker'.
  const effectivePanelState: LeftPanelState =
    !selectedClientId                           ? 'type-picker'
    : (loadingBrief && !isGenerating && panelState !== 'clone') ? 'type-picker'
    : panelState;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="flex flex-col bg-slate-950 overflow-hidden" style={{ height: 'calc(100vh - 0px)' }}>

        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <div className="flex-none flex items-center gap-3 px-4 h-14 bg-slate-900 border-b border-slate-800 z-10">
          {/* Logo + title */}
          <div className="flex items-center gap-2 mr-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white hidden sm:block">AI Website Builder</span>
          </div>

          {/* Client dropdown */}
          <div className="relative">
            <select
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer min-w-[180px]"
              value={selectedClientId}
              onChange={e => { setSelectedClientId(e.target.value); setMessages([]); }}
              disabled={loadingClients}
            >
              <option value="">Select client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.business_name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {loadingBrief && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}

          {/* Media tab — available whenever a client is selected */}
          {selectedClientId && !hasWebsite && (
            <div className="ml-auto flex items-center">
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => { setRightView('media'); setSettingsOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    rightView === 'media' && !settingsOpen
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Image className="w-3.5 h-3.5" /> Media
                </button>
              </div>
            </div>
          )}

          {/* Right side — only shown when site exists */}
          {hasWebsite && (
            <div className="ml-auto flex items-center gap-2">
              {/* AI provider badge */}
              {(() => {
                const opt = getProviderOption(brief?.ai_provider || selectedProvider);
                return opt ? (
                  <span className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${opt.badgeColor || 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                    <Sparkles className="w-3 h-3" />
                    {opt.label}
                  </span>
                ) : null;
              })()}

              {/* Page count badge */}
              <span className="hidden sm:flex items-center gap-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
                <FileText className="w-3.5 h-3.5" />
                {pageCount} page{pageCount !== 1 ? 's' : ''}
              </span>

              {/* Chat / Pages tab switcher */}
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => { setRightView('build'); setSettingsOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    rightView === 'build' && !settingsOpen
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button
                  onClick={() => { setRightView('pages'); setSettingsOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    rightView === 'pages' && !settingsOpen
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Pages
                </button>
                <button
                  onClick={() => { setRightView('media'); setSettingsOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    rightView === 'media' && !settingsOpen
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Image className="w-3.5 h-3.5" /> Media
                </button>
              </div>

              {/* Settings */}
              <button
                onClick={() => setSettingsOpen(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  settingsOpen
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>

              {/* Publish toggle */}
              <button
                onClick={handleTogglePublish}
                disabled={isTogglingPublish}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  brief?.is_published
                    ? 'bg-emerald-900/50 border-emerald-700 text-emerald-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {isTogglingPublish
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : brief?.is_published
                    ? <><ToggleRight className="w-3.5 h-3.5" /> Published</>
                    : <><ToggleLeft className="w-3.5 h-3.5" /> Draft</>
                }
              </button>

              {/* Preview link */}
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Main area ───────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left Panel ────────────────────────────────────────────────── */}
          <div className="w-[400px] flex-none flex flex-col bg-slate-900 border-r border-slate-800 overflow-hidden">

            {/* ── State 1: Type Picker ──────────────────────────────────── */}
            {effectivePanelState === 'type-picker' && (
              <div className="flex-1 overflow-y-auto p-5">
                {!selectedClientId ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <Globe className="w-12 h-12 text-slate-700 mb-4" />
                    <p className="text-slate-400 text-sm">Select a client to get started</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-5">
                      <h2 className="text-white font-semibold text-base">What kind of website?</h2>
                      <p className="text-slate-400 text-sm mt-1">Choose a type to get started</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {WEBSITE_TYPES.map(type => (
                        <button
                          key={type.label}
                          onClick={() => {
                            setForm(f => ({ ...f, industry: type.industry }));
                            setPanelState('brief-form');
                          }}
                          className="flex flex-col items-start gap-1 p-3.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500 hover:bg-slate-750 transition-all text-left group"
                        >
                          <span className="text-2xl leading-none mb-1">{type.emoji}</span>
                          <span className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">{type.label}</span>
                          <span className="text-xs text-slate-400 leading-snug">{type.desc}</span>
                        </button>
                      ))}

                      {/* Clone Existing Website card — spans full width */}
                      <button
                        onClick={() => {
                          setCloneError(null);
                          setPanelState('clone');
                        }}
                        className="col-span-2 flex items-center gap-3 p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-800 hover:border-indigo-500 hover:bg-indigo-900/40 transition-all text-left group"
                      >
                        <span className="w-10 h-10 rounded-lg bg-indigo-800/60 flex items-center justify-center flex-shrink-0">
                          <Image className="w-5 h-5 text-indigo-300" />
                        </span>
                        <div>
                          <span className="text-sm font-semibold text-indigo-200 group-hover:text-white transition-colors block">Clone a Website</span>
                          <span className="text-xs text-indigo-400 leading-snug">Upload a screenshot or enter a domain to copy the look</span>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── State 2: Brief Form ───────────────────────────────────── */}
            {effectivePanelState === 'brief-form' && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-4">
                  {/* Back to type picker */}
                  {!brief && (
                    <button
                      onClick={() => setPanelState('type-picker')}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
                    </button>
                  )}

                  <div>
                    <h2 className="text-white font-semibold text-base">Site Brief</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Tell the AI about this business</p>
                  </div>

                  {genError && (
                    <div className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{genError}</span>
                    </div>
                  )}

                  {/* Business Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Business Name *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      value={form.business_name}
                      onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                      placeholder="Acme Plumbing Co."
                    />
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Industry *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      value={form.industry}
                      onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                      placeholder="Plumbing, HVAC, Interior Design..."
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Location *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="Atlanta, GA"
                    />
                  </div>

                  {/* Services */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Services Offered *</label>
                    <textarea
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                      rows={3}
                      value={form.services_offered}
                      onChange={e => setForm(f => ({ ...f, services_offered: e.target.value }))}
                      placeholder="Emergency repairs, water heater install, drain cleaning..."
                    />
                  </div>

                  {/* Brand Tone */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Brand Tone</label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, tone: t }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            form.tone === t
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Brand Color */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer p-0.5"
                        value={form.primary_color}
                        onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        value={form.primary_color}
                        onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* AI Provider */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">AI Provider</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                      value={selectedProvider}
                      onChange={e => setSelectedProvider(e.target.value)}
                    >
                      {AI_PROVIDER_OPTIONS.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.label}{p.badge ? ` — ${p.badge}` : ''}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const opt = getProviderOption(selectedProvider);
                      return opt ? (
                        <p className="text-xs text-slate-500 mt-1.5">{opt.description}</p>
                      ) : null;
                    })()}
                  </div>

                  {/* Design Notes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Design Notes <span className="text-slate-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                      rows={2}
                      value={form.art_direction}
                      onChange={e => setForm(f => ({ ...f, art_direction: e.target.value }))}
                      placeholder="Luxurious, minimal, lots of white space..."
                    />
                  </div>

                  {/* Pages */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">Pages</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_PAGE_OPTIONS.map(option => {
                        const isSelected = selectedPages.has(option.id);
                        const isLocked   = option.locked;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => !isLocked && togglePage(option.id)}
                            disabled={isLocked}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                            } ${isLocked ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                          >
                            {option.name}
                            {isLocked && <span className="ml-1 text-indigo-300 opacity-60">●</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Generate button — sticky at bottom */}
                <div className="flex-none p-4 border-t border-slate-800 bg-slate-900">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={!isFormValid || isGenerating || !selectedClientId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    <Wand2 className="w-4 h-4" />
                    Generate Website ({selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''})
                  </button>
                </div>
              </div>
            )}

            {/* ── State 2b: Clone Panel ────────────────────────────────── */}
            {effectivePanelState === 'clone' && (
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="p-5 space-y-4 flex-1">
                  {/* Back */}
                  <button
                    onClick={() => setPanelState('type-picker')}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
                  </button>

                  <div>
                    <h2 className="text-white font-semibold text-base flex items-center gap-2">
                      <Image className="w-4 h-4 text-indigo-400" /> Clone a Website
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">Mirror the look of an existing site</p>
                  </div>

                  {cloneError && (
                    <div className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{cloneError}</span>
                    </div>
                  )}

                  {/* Mode tabs */}
                  <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
                    <button
                      onClick={() => setCloneMode('url')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
                        cloneMode === 'url'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" /> By URL / Domain
                    </button>
                    <button
                      onClick={() => setCloneMode('image')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
                        cloneMode === 'image'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" /> Screenshot
                    </button>
                  </div>

                  {/* ── URL mode ── */}
                  {cloneMode === 'url' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Website URL or Domain *
                        </label>
                        <input
                          type="text"
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          value={cloneUrl}
                          onChange={e => setCloneUrl(e.target.value)}
                          placeholder="https://example.com"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          We'll scrape the site's content and design, then rebuild it on CWP.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Brand Tone</label>
                        <div className="flex flex-wrap gap-2">
                          {TONES.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, tone: t }))}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                form.tone === t
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Screenshot mode ── */}
                  {cloneMode === 'image' && (
                    <div className="space-y-3">
                      {/* Image upload area */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Website Screenshot *
                        </label>
                        <input
                          ref={cloneFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleCloneImageChange(file);
                          }}
                        />
                        {cloneImagePreview ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                            <img
                              src={cloneImagePreview}
                              alt="Website screenshot preview"
                              className="w-full object-cover max-h-40"
                            />
                            <button
                              onClick={() => {
                                setCloneImage(null);
                                setCloneImagePreview(null);
                                if (cloneFileInputRef.current) cloneFileInputRef.current.value = '';
                              }}
                              className="absolute top-2 right-2 w-6 h-6 bg-slate-900/80 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => cloneFileInputRef.current?.click()}
                            className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl bg-slate-800 border border-dashed border-slate-600 hover:border-indigo-500 hover:bg-slate-750 transition-all text-center"
                          >
                            <Upload className="w-6 h-6 text-slate-500" />
                            <span className="text-xs text-slate-400">Click to upload screenshot</span>
                            <span className="text-xs text-slate-600">PNG, JPG, WEBP — max 10MB</span>
                          </button>
                        )}
                      </div>

                      {/* Business fields */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Business Name *</label>
                        <input
                          type="text"
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          value={cloneForm.business_name}
                          onChange={e => setCloneForm(f => ({ ...f, business_name: e.target.value }))}
                          placeholder="Acme Plumbing Co."
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Industry *</label>
                        <input
                          type="text"
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          value={cloneForm.industry}
                          onChange={e => setCloneForm(f => ({ ...f, industry: e.target.value }))}
                          placeholder="Plumbing, HVAC, Design..."
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Location *</label>
                        <input
                          type="text"
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          value={cloneForm.location}
                          onChange={e => setCloneForm(f => ({ ...f, location: e.target.value }))}
                          placeholder="Atlanta, GA"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Services Offered *</label>
                        <textarea
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                          rows={2}
                          value={cloneForm.services_offered}
                          onChange={e => setCloneForm(f => ({ ...f, services_offered: e.target.value }))}
                          placeholder="Emergency repairs, installations..."
                        />
                      </div>

                      {/* Tone */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Brand Tone</label>
                        <div className="flex flex-wrap gap-2">
                          {TONES.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setCloneForm(f => ({ ...f, tone: t }))}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                cloneForm.tone === t
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Color override */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Brand Color <span className="text-slate-500 font-normal">(optional — AI will extract from screenshot)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer p-0.5"
                            value={cloneForm.primary_color}
                            onChange={e => setCloneForm(f => ({ ...f, primary_color: e.target.value }))}
                          />
                          <input
                            type="text"
                            className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                            value={cloneForm.primary_color}
                            onChange={e => setCloneForm(f => ({ ...f, primary_color: e.target.value }))}
                            maxLength={7}
                          />
                        </div>
                      </div>

                      {/* Pages */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-2">Pages to Generate</label>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_PAGE_OPTIONS.map(option => {
                            const isSelected = selectedPages.has(option.id);
                            const isLocked = option.locked;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => !isLocked && togglePage(option.id)}
                                disabled={isLocked}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                                } ${isLocked ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                              >
                                {option.name}
                                {isLocked && <span className="ml-1 text-indigo-300 opacity-60">●</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clone button — sticky at bottom */}
                <div className="flex-none p-4 border-t border-slate-800 bg-slate-900">
                  <button
                    onClick={handleClone}
                    disabled={
                      isGenerating || !selectedClientId ||
                      (cloneMode === 'url' && !cloneUrl.trim()) ||
                      (cloneMode === 'image' && (!cloneImage || !cloneForm.business_name || !cloneForm.industry || !cloneForm.services_offered || !cloneForm.location))
                    }
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    <Image className="w-4 h-4" />
                    {cloneMode === 'url' ? 'Clone Website' : `Clone Design (${selectedPages.size} page${selectedPages.size !== 1 ? 's' : ''})`}
                  </button>
                </div>
              </div>
            )}

            {/* ── Stuck generating timeout error ────────────────────────── */}
            {effectivePanelState === 'generating' && isStuckGenerating && (
              <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-800">Generation timed out</p>
                  <p className="text-sm text-red-600 mt-1">The AI took too long. Please try generating again.</p>
                  <button
                    onClick={async () => {
                      await supabase.from('website_briefs')
                        .update({ generation_status: 'error', generation_error: 'Generation timed out' })
                        .eq('client_id', selectedClientId);
                      await loadBrief(selectedClientId);
                    }}
                    className="mt-3 text-sm text-red-700 underline"
                  >
                    Dismiss and retry
                  </button>
                </div>
              </div>
            )}

            {/* ── State 3: Generating ───────────────────────────────────── */}
            {effectivePanelState === 'generating' && !isStuckGenerating && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-slate-700 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  </div>
                  <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-white font-semibold text-base">{generatingLabel}</p>
                  <p className="text-slate-400 text-sm mt-1">This takes about 30–60 seconds</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {Array.from(selectedPages).map(pid => {
                    const opt = ALL_PAGE_OPTIONS.find(o => o.id === pid);
                    return opt ? (
                      <span key={pid} className="px-2.5 py-1 bg-indigo-900/50 border border-indigo-800 text-indigo-300 rounded-full text-xs font-medium">
                        {opt.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* ── State 4: Chat Mode ────────────────────────────────────── */}
            {effectivePanelState === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Message thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-900/50 border border-indigo-800 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-slate-300 text-sm font-medium">Site generated!</p>
                        <p className="text-slate-500 text-xs mt-1">Ask me to make changes or refine the design</p>
                      </div>
                    </div>
                  )}
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                        <span className="text-sm text-slate-400">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Re-clone panel */}
                {showReclonePanel && (
                  <div className="flex-none mx-3 mb-2 bg-slate-900 border border-amber-700/40 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">Re-clone from reference</p>
                      <button onClick={() => setShowReclonePanel(false)} className="text-slate-500 hover:text-slate-300">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Mode toggle */}
                    <div className="flex gap-1.5">
                      {(['url', 'image'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setRecloneMode(m)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            recloneMode === m
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {m === 'url' ? '🌐 Domain / URL' : '📷 Screenshot'}
                        </button>
                      ))}
                    </div>

                    {/* URL mode */}
                    {recloneMode === 'url' && (
                      <input
                        type="text"
                        value={recloneUrl}
                        onChange={e => setRecloneUrl(e.target.value)}
                        placeholder="e.g. https://clientsite.com"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    )}

                    {/* Image mode */}
                    {recloneMode === 'image' && (
                      <div
                        className="border-2 border-dashed border-slate-700 rounded-xl p-3 text-center cursor-pointer hover:border-amber-600 transition-colors"
                        onClick={() => {
                          const i = document.createElement('input');
                          i.type = 'file';
                          i.accept = 'image/*';
                          i.onchange = (e) => {
                            const f = (e.target as HTMLInputElement).files?.[0];
                            if (f) {
                              setRecloneImage(f);
                              const r = new FileReader();
                              r.onload = (ev) => setRecloneImagePreview(ev.target?.result as string);
                              r.readAsDataURL(f);
                            }
                          };
                          i.click();
                        }}
                      >
                        {recloneImagePreview ? (
                          <img src={recloneImagePreview} alt="Preview" className="max-h-28 mx-auto rounded object-contain" />
                        ) : (
                          <p className="text-xs text-slate-500">Click to upload screenshot</p>
                        )}
                      </div>
                    )}

                    {recloneError && (
                      <p className="text-xs text-red-400">{recloneError}</p>
                    )}

                    <button
                      onClick={handleReclone}
                      disabled={isRecloning || (recloneMode === 'url' ? !recloneUrl.trim() : !recloneImage)}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {isRecloning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Recloning...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild from Reference</>}
                    </button>

                    <p className="text-xs text-slate-600 text-center">
                      This overwrites the current site. All existing content will be replaced.
                    </p>
                  </div>
                )}

                {/* Quick prompt chips */}
                <div className="flex-none px-3 pb-2">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      onClick={() => setShowReclonePanel(v => !v)}
                      disabled={isChatLoading || isRecloning}
                      className="flex-none flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/40 border border-amber-700/60 text-amber-300 text-xs rounded-full hover:border-amber-500 hover:text-amber-200 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Re-clone Page
                    </button>
                    {QUICK_PROMPTS.map(p => (
                      <button
                        key={p}
                        onClick={() => handleChatSend(p)}
                        disabled={isChatLoading}
                        className="flex-none px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-full hover:border-indigo-600 hover:text-indigo-300 transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat input */}
                <div className="flex-none p-3 border-t border-slate-800">
                  <div className="flex items-end gap-2 bg-slate-800 border border-slate-700 rounded-xl p-2 focus-within:border-indigo-500 transition-colors">
                    <div className="flex items-center gap-1 flex-none">
                      <Bot className="w-3.5 h-3.5 text-slate-500 flex-none" />
                      <select
                        value={chatProvider}
                        onChange={e => setChatProvider(e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[110px]"
                      >
                        {AI_PROVIDER_OPTIONS.map(p => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      ref={chatInputRef}
                      className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none focus:outline-none leading-relaxed min-h-[36px] max-h-[100px]"
                      placeholder="Ask me to change anything..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleChatSend();
                        }
                      }}
                      rows={1}
                    />
                    <button
                      onClick={() => handleChatSend()}
                      disabled={!chatInput.trim() || isChatLoading}
                      className="flex-none w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Panel ───────────────────────────────────────────────── */}
          <div className="flex-1 relative overflow-hidden bg-slate-950">

            {/* ── Build View (iframe) ──────────────────────────────────── */}
            {rightView === 'build' && !settingsOpen && (
              <>
                {hasWebsite && currentPreviewUrl ? (
                  <div className="flex flex-col h-full p-4 gap-3">
                    {/* Fake browser chrome */}
                    <div className="flex-none flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-t-xl px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500/70" />
                        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                        <span className="w-3 h-3 rounded-full bg-green-500/70" />
                      </div>
                      {/* Page nav: Home button when on a sub-page */}
                      {activePreviewPageSlug && (
                        <button
                          onClick={() => setActivePreviewPageSlug('')}
                          className="flex-none flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-200 border border-indigo-800 hover:border-indigo-500 rounded px-2 py-0.5 transition-colors"
                          title="Back to Home page"
                        >
                          <Globe className="w-3 h-3" />
                          Home
                        </button>
                      )}
                      <div className="flex-1 flex items-center bg-slate-800 border border-slate-700 rounded-md px-3 py-1 mx-2 gap-2">
                        <span className="text-xs text-slate-400 truncate font-mono">
                          {window.location.origin}{currentPreviewUrl}
                        </span>
                      </div>
                      <a
                        href={currentPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <iframe
                      key={currentPreviewUrl}
                      src={currentPreviewUrl}
                      className="flex-1 w-full rounded-b-xl border-x border-b border-slate-800 bg-white"
                      title="Site Preview"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-4 p-8">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <Globe className="w-8 h-8 text-slate-700" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm font-medium">No site yet</p>
                      <p className="text-slate-600 text-xs mt-1">Fill in the brief and click Generate</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Pages View ───────────────────────────────────────────── */}
            {rightView === 'pages' && !settingsOpen && (
              <div className="h-full overflow-y-auto p-5 space-y-3">
                {hasWebsite ? (
                  <>
                    <h3 className="text-white font-semibold text-sm mb-4">
                      Pages <span className="text-slate-500 font-normal">({pageCount})</span>
                    </h3>
                    {brief!.website_json!.pages.map((page: any) => {
                      const isExpanded = expandedPages[page.id] ?? false;
                      const isActivePage = activePreviewPageSlug === (page.slug ?? '');
                      return (
                        <div key={page.id} className={`bg-slate-900 border rounded-xl overflow-hidden ${isActivePage ? 'border-indigo-600' : 'border-slate-800'}`}>
                          <div className="flex items-center gap-2 px-4 py-3.5">
                            {/* Expand/collapse toggle */}
                            <button
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                              onClick={() => setExpandedPages(prev => ({ ...prev, [page.id]: !isExpanded }))}
                            >
                              <FileText className={`w-4 h-4 flex-shrink-0 ${isActivePage ? 'text-indigo-400' : 'text-slate-500'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-slate-100 text-sm">{page.name}</span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    {page.slug ? `/${page.slug}` : '/'}
                                  </span>
                                  {isActivePage && (
                                    <span className="text-xs bg-indigo-900/60 border border-indigo-700 text-indigo-300 px-1.5 py-0.5 rounded">viewing</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{page.seo?.title}</p>
                              </div>
                            </button>
                            {/* Right side: section count + preview button + chevron */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-slate-500">{page.sections.length} sections</span>
                              {/* Preview this page */}
                              <button
                                onClick={() => {
                                  setActivePreviewPageSlug(page.slug ?? '');
                                  setRightView('build');
                                }}
                                title="Preview this page"
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                                  isActivePage
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-600 hover:text-indigo-300'
                                }`}
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </button>
                              <button
                                onClick={() => setExpandedPages(prev => ({ ...prev, [page.id]: !isExpanded }))}
                                className="text-slate-500 hover:text-slate-300"
                              >
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />
                                }
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-2">
                              {/* SEO */}
                              <div className="p-3 bg-slate-800/50 rounded-lg text-xs space-y-1">
                                <p className="text-slate-400 font-medium">SEO</p>
                                <p className="text-slate-200 font-medium">{page.seo?.title}</p>
                                <p className="text-slate-400 leading-relaxed">{page.seo?.meta_description}</p>
                              </div>
                              {/* Sections */}
                              {page.sections.map((section: any, si: number) => (
                                <div key={si} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
                                  <span className="text-xs font-mono bg-indigo-900/50 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded flex-shrink-0">
                                    {section.section_type}
                                  </span>
                                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex-shrink-0">
                                    {section.variant}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                    No pages yet — generate a site first.
                  </div>
                )}
              </div>
            )}

            {/* ── Media Library ─────────────────────────────────────── */}
            {rightView === 'media' && !settingsOpen && (
              <WebsiteMediaPanel clientId={selectedClientId} />
            )}

            {/* ── Settings Panel (overlay) ────────────────────────────── */}
            {settingsOpen && (
              <div className="absolute inset-0 bg-slate-950 overflow-y-auto z-10">
                <div className="p-5 space-y-5">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold text-base flex items-center gap-2">
                      <Settings className="w-4 h-4 text-indigo-400" /> Settings
                    </h3>
                    <button
                      onClick={() => setSettingsOpen(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* ── Edit Brief ─────────────────────────────────────── */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-slate-200">Edit Brief</h4>

                    <div className="space-y-3">
                      {([
                        ['Business Name', 'business_name', 'text', 'Acme Plumbing Co.'],
                        ['Industry',      'industry',      'text', 'Plumbing, HVAC...'],
                        ['Location',      'location',      'text', 'Atlanta, GA'],
                      ] as const).map(([label, key, type, placeholder]) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                          <input
                            type={type}
                            className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                            value={settingsForm[key]}
                            onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder={placeholder}
                          />
                        </div>
                      ))}

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Services Offered</label>
                        <textarea
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                          rows={2}
                          value={settingsForm.services_offered}
                          onChange={e => setSettingsForm(f => ({ ...f, services_offered: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Design Notes</label>
                        <textarea
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                          rows={2}
                          value={settingsForm.art_direction}
                          onChange={e => setSettingsForm(f => ({ ...f, art_direction: e.target.value }))}
                        />
                      </div>

                      {/* AI Provider selector for regeneration */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">AI Model for Regeneration</label>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                          value={selectedProvider}
                          onChange={e => setSelectedProvider(e.target.value)}
                        >
                          {AI_PROVIDER_OPTIONS.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.label}{p.badge ? ` — ${p.badge}` : ''}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const opt = getProviderOption(selectedProvider);
                          return opt ? (
                            <p className="text-xs text-slate-500 mt-1">{opt.description}</p>
                          ) : null;
                        })()}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="w-8 h-8 rounded border border-slate-700 bg-slate-800 cursor-pointer p-0.5"
                          value={settingsForm.primary_color}
                          onChange={e => setSettingsForm(f => ({ ...f, primary_color: e.target.value }))}
                        />
                        <input
                          type="text"
                          className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                          value={settingsForm.primary_color}
                          onChange={e => setSettingsForm(f => ({ ...f, primary_color: e.target.value }))}
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setForm(settingsForm);
                        setSettingsOpen(false);
                        handleGenerate(settingsForm);
                      }}
                      disabled={isGenerating || !selectedClientId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerate with New Brief
                    </button>
                  </div>

                  {/* ── Custom Domain ───────────────────────────────────── */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-semibold text-slate-200">Custom Domain</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Connect a domain the client purchased (e.g. Namecheap, Squarespace).
                    </p>

                    {brief?.custom_domain && (
                      <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Connected: <span className="font-mono">{brief.custom_domain}</span>
                      </p>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        placeholder="www.clientsite.com"
                        value={customDomainInput}
                        onChange={e => setCustomDomainInput(e.target.value.trim().toLowerCase())}
                      />
                      <button
                        onClick={handleSaveDomain}
                        disabled={savingDomain}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {savingDomain
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : domainSaved
                            ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</>
                            : <><Save className="w-3.5 h-3.5" /> Save</>
                        }
                      </button>
                    </div>

                    {domainError && <p className="text-xs text-red-400">{domainError}</p>}

                    {/* Copy site URL */}
                    <button
                      onClick={copyUrl}
                      disabled={!brief?.client_slug}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
                    >
                      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : `Copy site URL (/site/${brief?.client_slug || '…'})`}
                    </button>

                    {/* DNS Instructions */}
                    <button
                      onClick={() => setShowDnsInstructions(o => !o)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      {showDnsInstructions ? 'Hide' : 'Show'} DNS setup instructions
                    </button>

                    {showDnsInstructions && (
                      <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-xs text-slate-400 space-y-2">
                        <p className="font-semibold text-slate-300">Client DNS setup</p>
                        <ol className="space-y-1.5 list-decimal list-inside">
                          <li>Log into their domain registrar → DNS settings</li>
                          <li>Add <strong className="text-slate-200">CNAME</strong>: Host <code className="text-indigo-300">www</code> → <code className="text-indigo-300">cname.vercel-dns.com</code></li>
                          <li>Add <strong className="text-slate-200">A record</strong>: Host <code className="text-indigo-300">@</code> → <code className="text-indigo-300">76.76.21.21</code></li>
                          <li>In Vercel project → Domains, add the client's domain</li>
                          <li>DNS propagation: up to 24–48 hours</li>
                        </ol>
                      </div>
                    )}
                  </div>

                  {/* ── Registrar Login ─────────────────────────────────── */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
                      <Key className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-semibold text-slate-200">Registrar Login</h4>
                      {domainCreds?.registrar_name && (
                        <span className="ml-auto text-xs bg-emerald-900/50 border border-emerald-800 text-emerald-400 font-medium px-2 py-0.5 rounded-full">
                          {domainCreds.registrar_name}
                        </span>
                      )}
                    </div>

                    {!domainCreds?.username ? (
                      <div className="px-4 py-6 text-center">
                        <Key className="w-7 h-7 text-slate-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">No credentials submitted yet.</p>
                        <p className="text-xs text-slate-600 mt-1">Client portal → My Website → Domain Registrar Access</p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {domainCreds.login_url && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-16 flex-shrink-0">Login URL</span>
                            <a
                              href={domainCreds.login_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 truncate flex-1"
                            >
                              {domainCreds.login_url}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-16 flex-shrink-0">Username</span>
                          <span className="flex-1 text-sm text-slate-200 font-mono truncate">{domainCreds.username}</span>
                          <button
                            onClick={() => copyField(domainCreds.username, 'username')}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 flex-shrink-0 transition-colors"
                          >
                            {copiedField === 'username'
                              ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                              : <><Copy className="w-3.5 h-3.5" /> Copy</>
                            }
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-16 flex-shrink-0">Password</span>
                          <span className="flex-1 text-sm text-slate-200 font-mono truncate">
                            {showPassword ? domainCreds.password : '••••••••'}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => setShowPassword(v => !v)} className="text-slate-500 hover:text-indigo-400 transition-colors">
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => copyField(domainCreds.password, 'password')}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                            >
                              {copiedField === 'password'
                                ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                                : <><Copy className="w-3.5 h-3.5" /> Copy</>
                              }
                            </button>
                          </div>
                        </div>

                        {domainCreds.notes && (
                          <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300/80">
                            <p className="font-semibold text-amber-300 mb-0.5">Notes from client:</p>
                            <p>{domainCreds.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>{/* end right panel */}
        </div>{/* end main area */}
      </div>
    </AdminLayout>
  );
};

export default AdminWebsiteBuilder;

