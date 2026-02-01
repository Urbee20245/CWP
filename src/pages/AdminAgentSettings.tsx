"use client";

import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import { supabase } from '../integrations/supabase/client';
import {
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Globe,
  Info,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Save,
  Shield,
  Wand2,
  Zap,
  X
} from 'lucide-react';
import { renderPromptTemplate, getPromptCategories, TemplateCategory, buildRoleDirectives } from '../utils/promptTemplates';

interface Client {
  id: string;
  business_name: string;
}

interface AgentSettings {
  id?: string;
  client_id: string;
  retell_agent_id?: string;
  agent_name: string;
  system_prompt: string;
  greeting_message: string;
  can_check_availability: boolean;
  can_book_meetings: boolean;
  can_transfer_calls: boolean;
  can_send_sms: boolean;
  default_meeting_duration: number;
  booking_buffer_minutes: number;
  max_advance_booking_days: number;
  allowed_meeting_types: string[];
  business_hours: Record<string, { start: string; end: string }>;
  timezone: string;
  is_active: boolean;
}

interface WebhookEvent {
  id: string;
  event_type: string;
  event_source: string;
  external_id: string | null;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface IntegrationStatus {
  google_calendar: { connected: boolean; calendar_id?: string; last_synced?: string };
  retell: { configured: boolean; agent_id?: string; voice_status?: string; phone_number?: string };
}

const SUPABASE_FUNCTIONS_BASE = 'https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1';

const DEFAULT_SETTINGS: Omit<AgentSettings, 'client_id'> = {
  agent_name: 'AI Assistant',
  system_prompt: '',
  greeting_message: '',
  can_check_availability: true,
  can_book_meetings: true,
  can_transfer_calls: false,
  can_send_sms: false,
  default_meeting_duration: 30,
  booking_buffer_minutes: 15,
  max_advance_booking_days: 30,
  allowed_meeting_types: ['phone', 'video'],
  business_hours: {
    '1': { start: '09:00', end: '17:00' },
    '2': { start: '09:00', end: '17:00' },
    '3': { start: '09:00', end: '17:00' },
    '4': { start: '09:00', end: '17:00' },
    '5': { start: '09:00', end: '17:00' },
  },
  timezone: 'America/New_York',
  is_active: true,
};

const DAY_NAMES: Record<string, string> = {
  '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
  '4': 'Thursday', '5': 'Friday', '6': 'Saturday',
};

const TIMEZONE_OPTIONS = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
];

const AdminAgentSettings: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string> | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [showWebhooks, setShowWebhooks] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showBusinessHours, setShowBusinessHours] = useState(false);

  // Prompt assistant
  const [showAssistant, setShowAssistant] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [tone, setTone] = useState('Professional and friendly');
  const [location, setLocation] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [servicesOffered, setServicesOffered] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCategory | ''>('');

  // Role rules
  const [roleBookCalls, setRoleBookCalls] = useState(true);
  const [roleAskQuestions, setRoleAskQuestions] = useState(true);
  const [roleCollectData, setRoleCollectData] = useState(true);

  // Add retrieving state for integration status
  const [isRetrieving, setIsRetrieving] = useState(false);

  const showFeedback = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 6000);
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, business_name')
          .order('business_name', { ascending: true });
        if (error) throw error;
        setClients(data || []);
      } catch (err: any) {
        console.error('[AdminAgentSettings] Failed to fetch clients:', err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClients();
  }, []);

  const buildWebhookUrls = () => ({
    retell_webhook: `${SUPABASE_FUNCTIONS_BASE}/retell-webhook`,
    check_availability: `${SUPABASE_FUNCTIONS_BASE}/check-availability`,
    book_meeting: `${SUPABASE_FUNCTIONS_BASE}/book-meeting`,
  });

  const fetchSettings = useCallback(async (clientId: string) => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      // Prefer the secure Edge Function so admins always see integration status
      // even if RLS/admin JWT claims aren't present in the browser session.
      let edge: any = null;
      try {
        edge = await AdminService.getAgentSettings(clientId);
      } catch (edgeErr: any) {
        console.warn('[AdminAgentSettings] getAgentSettings edge function failed, falling back to direct queries:', edgeErr?.message);
      }

      const [{ data: settingsRow, error: settingsErr }, { data: recentEvents }, { data: clientRow }] = await Promise.all([
        supabase.from('ai_agent_settings').select('*').eq('client_id', clientId).maybeSingle(),
        // If edge function worked, use its events; otherwise fall back to direct.
        edge?.recent_events
          ? Promise.resolve({ data: edge.recent_events })
          : supabase
              .from('webhook_events')
              .select('id, event_type, event_source, external_id, status, error_message, duration_ms, created_at')
              .eq('client_id', clientId)
              .order('created_at', { ascending: false })
              .limit(20),
        supabase.from('clients').select('phone, address').eq('id', clientId).maybeSingle(),
      ] as any);

      if (settingsErr) throw settingsErr;

      const merged = settingsRow
        ? { ...DEFAULT_SETTINGS, ...settingsRow, client_id: clientId }
        : { ...DEFAULT_SETTINGS, client_id: clientId };

      setSettings(merged);

      // Webhook URLs: prefer edge function output (always correct base)
      setWebhookUrls(edge?.webhook_urls ? edge.webhook_urls : buildWebhookUrls());

      setWebhookEvents(recentEvents || []);

      // Auto-fill assistant fields from client record
      if (clientRow) {
        setBusinessPhone(clientRow.phone || '');
        setLocation(clientRow.address || '');
      }

      // Integration status: prefer edge function output
      if (edge?.integrations) {
        setIntegrations(edge.integrations);
      } else {
        // Direct fallback
        const [{ data: calendarRow }, { data: voiceRow }] = await Promise.all([
          supabase
            .from('client_google_calendar')
            .select('connection_status, calendar_id, last_synced_at')
            .eq('client_id', clientId)
            .maybeSingle(),
          supabase
            .from('client_voice_integrations')
            .select('retell_agent_id, voice_status, phone_number')
            .eq('client_id', clientId)
            .maybeSingle(),
        ]);

        setIntegrations({
          google_calendar: calendarRow
            ? {
                connected: calendarRow.connection_status === 'connected',
                calendar_id: calendarRow.calendar_id,
                last_synced: calendarRow.last_synced_at,
              }
            : { connected: false },
          retell: voiceRow
            ? {
                configured: !!voiceRow.retell_agent_id,
                agent_id: voiceRow.retell_agent_id,
                voice_status: voiceRow.voice_status,
                phone_number: voiceRow.phone_number,
              }
            : { configured: false },
        });
      }
    } catch (err: any) {
      console.error('[AdminAgentSettings] Failed to fetch settings:', err.message);
      showFeedback('error', `Failed to load settings: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add: retrieve integrations handler (server-side only for accurate status)
  const handleRetrieveIntegrations = async () => {
    if (!selectedClientId) return;
    setIsRetrieving(true);
    try {
      const edge = await AdminService.getAgentSettings(selectedClientId);
      if (edge?.integrations) {
        setIntegrations(edge.integrations);
        showFeedback('success', 'Integration status retrieved from server.');
      } else {
        await fetchSettings(selectedClientId);
        showFeedback('info', 'Refreshed settings.');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to retrieve status.');
    } finally {
      setIsRetrieving(false);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      fetchSettings(selectedClientId);
    } else {
      setSettings(null);
      setWebhookUrls(null);
      setWebhookEvents([]);
      setIntegrations(null);
    }
  }, [selectedClientId, fetchSettings]);

  const updateSetting = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showFeedback('success', 'Copied to clipboard.');
    } catch {
      showFeedback('error', 'Failed to copy.');
    }
  };

  const toggleMeetingType = (type: string) => {
    if (!settings) return;
    const current = settings.allowed_meeting_types || [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    updateSetting('allowed_meeting_types', next);
  };

  const toggleBusinessDay = (day: string) => {
    if (!settings) return;
    const hours = { ...(settings.business_hours || {}) };
    if (hours[day]) {
      delete hours[day];
    } else {
      hours[day] = { start: '09:00', end: '17:00' };
    }
    updateSetting('business_hours', hours);
  };

  const updateBusinessHours = (day: string, field: 'start' | 'end', value: string) => {
    if (!settings) return;
    const hours = { ...(settings.business_hours || {}) };
    if (!hours[day]) hours[day] = { start: '09:00', end: '17:00' };
    hours[day] = { ...hours[day], [field]: value };
    updateSetting('business_hours', hours);
  };

  const handleSave = async () => {
    if (!settings || !selectedClientId) return;
    setIsSaving(true);
    try {
      const payload: any = {
        client_id: selectedClientId,
        retell_agent_id: settings.retell_agent_id || null,
        agent_name: settings.agent_name,
        system_prompt: settings.system_prompt,
        greeting_message: settings.greeting_message,
        can_check_availability: settings.can_check_availability,
        can_book_meetings: settings.can_book_meetings,
        can_transfer_calls: settings.can_transfer_calls,
        can_send_sms: settings.can_send_sms,
        default_meeting_duration: settings.default_meeting_duration,
        booking_buffer_minutes: settings.booking_buffer_minutes,
        max_advance_booking_days: settings.max_advance_booking_days,
        allowed_meeting_types: settings.allowed_meeting_types,
        business_hours: settings.business_hours,
        timezone: settings.timezone,
        is_active: settings.is_active,
      };

      const { error: upsertErr } = await supabase.from('ai_agent_settings').upsert(payload, { onConflict: 'client_id' });
      if (upsertErr) throw upsertErr;

      if (settings.retell_agent_id && settings.retell_agent_id.trim()) {
        const { data: twilioIntegration } = await supabase.from('client_integrations').select('provider').eq('client_id', selectedClientId).eq('provider', 'twilio').maybeSingle();
        const inferredSource = twilioIntegration ? 'client' : 'platform';
        await supabase.from('client_voice_integrations').upsert({
          client_id: selectedClientId,
          retell_agent_id: settings.retell_agent_id.trim(),
          number_source: inferredSource,
          voice_status: 'inactive',
          a2p_status: inferredSource === 'platform' ? 'not_started' : 'none',
        }, { onConflict: 'client_id' });
      }

      showFeedback('success', 'Agent settings saved successfully.');
      await fetchSettings(selectedClientId);
    } catch (err: any) {
      showFeedback('error', `Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!settings) return;
    setIsGeneratingPrompt(true);
    try {
      const clientName = clients.find(c => c.id === selectedClientId)?.business_name;
      const result = await AdminService.generateSystemPromptFromWebsite(websiteUrl, clientName, {
        industry,
        tone,
        location,
        phone: businessPhone,
        services: servicesOffered,
        special_instructions: specialInstructions,
        // Encourage richer extraction
        include: ['business_name', 'services', 'contact', 'faqs', 'value_props', 'booking_policies'],
        min_detail: 'high',
      });

      if (!result?.success) throw new Error(result?.error || 'Generation failed');

      // Augment the generated prompt with role rules and business context
      const rules = buildRoleDirectives({
        bookCalls: roleBookCalls,
        askQuestions: roleAskQuestions,
        collectData: roleCollectData,
      });

      const businessBlock = [
        '',
        'BUSINESS CONTEXT (Auto-filled):',
        `- Business: ${clientName || ''}`,
        `- Location: ${location || 'N/A'}`,
        `- Phone: ${businessPhone || 'N/A'}`,
        `- Services: ${servicesOffered || 'N/A'}`,
        `- Website: ${websiteUrl || 'N/A'}`,
      ].join('\n');

      const finalPrompt = [result.system_prompt || '', businessBlock, rules].filter(Boolean).join('\n');
      updateSetting('system_prompt', finalPrompt);
      showFeedback('success', 'Robust prompt generated and enriched with role rules and business context.');
      setShowAssistant(false);
    } catch (err: any) {
      showFeedback('error', `Failed to generate prompt: ${err.message}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Helper to build template context
  const buildTemplateContext = () => {
    const clientName = clients.find(c => c.id === selectedClientId)?.business_name || '';
    return {
      businessName: clientName,
      industry: industry || (settings?.agent_name ? settings.agent_name : 'service'),
      location: location || '',
      phone: businessPhone || '',
      services: servicesOffered || '',
      website: websiteUrl || '',
    };
  };

  const handleInsertTemplate = () => {
    if (!settings || !selectedTemplate) return;
    const base = renderPromptTemplate(selectedTemplate, buildTemplateContext(), settings.agent_name || 'AI Assistant');
    const rules = buildRoleDirectives({
      bookCalls: roleBookCalls,
      askQuestions: roleAskQuestions,
      collectData: roleCollectData,
    });
    const businessBlock = [
      '',
      'BUSINESS CONTEXT (Auto-filled):',
      `- Business: ${clients.find(c => c.id === selectedClientId)?.business_name || ''}`,
      `- Location: ${location || 'N/A'}`,
      `- Phone: ${businessPhone || 'N/A'}`,
      `- Services: ${servicesOffered || 'N/A'}`,
      `- Website: ${websiteUrl || 'N/A'}`,
    ].join('\n');
    updateSetting('system_prompt', [base, businessBlock, rules].filter(Boolean).join('\n'));
    showFeedback('success', 'Template inserted with role rules and business context.');
  };

  // Generate Retell functions JSON for copy
  const functionsJson = (() => {
    const base = SUPABASE_FUNCTIONS_BASE;
    const defs = [
      {
        name: "check-availability",
        description: "Check Google Calendar availability before booking.",
        method: "POST",
        url: `${base}/check-availability`
      },
      {
        name: "book-appointment",
        description: "Book a meeting on Google Calendar after user confirms.",
        method: "POST",
        url: `${base}/book-meeting`
      },
      {
        name: "append-to-google-sheet",
        description: "Append caller info (name, phone, email, notes) to a Google Sheet.",
        method: "POST",
        url: `${base}/append-to-google-sheet`
      }
    ];
    return JSON.stringify({ functions: defs }, null, 2);
  })();

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Bot className="w-7 h-7 text-indigo-600" />
            AI Agent Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure per-client AI agent behavior, capabilities, and webhook integrations for Retell AI.</p>
        </div>

        {feedback && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : feedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : feedback.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            <span className="text-sm">{feedback.text}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Select Client</label>
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full md:w-96 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">-- Choose a client --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
        </div>

        {settings && !isLoading && (
          <>
            {integrations && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  Integration Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg border ${integrations.google_calendar.connected ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${integrations.google_calendar.connected ? 'text-green-600' : 'text-amber-600'}`} />
                      <span className="text-sm font-medium">Google Calendar</span>
                    </div>
                    <p className="text-xs mt-1 text-slate-600">{integrations.google_calendar.connected ? `Connected (${integrations.google_calendar.calendar_id || 'primary'})` : 'Not connected'}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${integrations.retell.configured ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center gap-2">
                      <Phone className={`w-4 h-4 ${integrations.retell.configured ? 'text-green-600' : 'text-amber-600'}`} />
                      <span className="text-sm font-medium">Retell AI</span>
                    </div>
                    <p className="text-xs mt-1 text-slate-600">{integrations.retell.configured ? `Agent: ${integrations.retell.agent_id} | ${integrations.retell.voice_status || 'inactive'}` : 'No agent configured yet'}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleRetrieveIntegrations}
                    disabled={isRetrieving || !selectedClientId}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                    title="Retrieve latest status from server"
                  >
                    {isRetrieving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {isRetrieving ? 'Retrieving...' : 'Retrieve Latest Status'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-500" />
                Agent Identity
              </h2>

              {/* Role Rules */}
              <div className="mb-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <p className="text-xs font-semibold text-slate-700 mb-2">Role Rules</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={roleBookCalls} onChange={(e) => setRoleBookCalls(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                    <span className="text-xs text-slate-700">Book Calls</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={roleAskQuestions} onChange={(e) => setRoleAskQuestions(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                    <span className="text-xs text-slate-700">Ask Questions (Discovery)</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={roleCollectData} onChange={(e) => setRoleCollectData(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                    <span className="text-xs text-slate-700">Collect Data</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">These rules append explicit directives to the prompt so the agent reliably books calls, qualifies leads, and collects the right info.</p>
              </div>

              {/* Prompt Templates (industry-specific) */}
              <div className="mb-4 p-3 rounded-lg border border-indigo-200 bg-indigo-50">
                <div className="flex flex-col md:flex-row md:items-end md:gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">
                      Prompt Templates (industry-specific)
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm bg-white"
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value as TemplateCategory)}
                    >
                      <option value="">-- Choose a template --</option>
                      {getPromptCategories().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleInsertTemplate}
                    disabled={!selectedTemplate}
                    className="mt-3 md:mt-0 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Insert Template
                  </button>
                </div>
                <p className="text-[11px] text-indigo-700 mt-2">
                  Templates auto-fill business name, location, phone, and services. Role Rules are appended automatically.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Agent Name</label>
                  <input type="text" value={settings.agent_name} onChange={(e) => updateSetting('agent_name', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">System Prompt</label>
                    <button onClick={() => setShowAssistant(!showAssistant)} className="text-xs text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-700">
                      <Wand2 className="w-3 h-3" /> {showAssistant ? 'Close Assistant' : 'AI Prompt Assistant'}
                    </button>
                  </div>
                  
                  {showAssistant && (
                    <div className="mb-4 p-4 rounded-lg border border-indigo-200 bg-indigo-50 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-indigo-900 flex items-center gap-2"><Zap className="w-4 h-4" /> AI Prompt Assistant <span className="text-[10px] bg-indigo-200 px-1.5 py-0.5 rounded text-indigo-700 uppercase">Gemini</span></p>
                        <button onClick={() => setShowAssistant(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                      </div>
                      <p className="text-xs text-indigo-700">Provide context about this client's business and we'll generate a tailored system prompt. The more detail you provide, the better the result.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Industry / Business Type</label>
                          <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm" placeholder="e.g. Plumbing, Dental Office, Law Firm" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Tone / Style</label>
                          <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm">
                            <option>Professional and friendly</option>
                            <option>Aggressive and sales-focused</option>
                            <option>Empathetic and supportive</option>
                            <option>Casual and upbeat</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Location / Service Area</label>
                          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm" placeholder="e.g. Metro Atlanta, GA" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Business Phone</label>
                          <input type="text" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm" placeholder="e.g. (404) 555-1234" />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Services Offered</label>
                        <input type="text" value={servicesOffered} onChange={(e) => setServicesOffered(e.target.value)} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm" placeholder="e.g. Emergency repairs, installations, maintenance plans, free estimates" />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Special Instructions (optional)</label>
                        <textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} rows={2} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm" placeholder="e.g. Always ask for the caller's name and phone. Never quote prices over the phone." />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Website URL (for scraping)</label>
                        <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm" placeholder="https://example.com" />
                      </div>

                      <div className="p-2 bg-indigo-100/50 rounded border border-indigo-200">
                        <p className="text-[10px] text-indigo-700 flex items-center gap-1.5"><Info className="w-3 h-3" /> Agent name, capabilities, and business hours from this page are included automatically.</p>
                      </div>

                      <button onClick={handleGeneratePrompt} disabled={isGeneratingPrompt} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {isGeneratingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {isGeneratingPrompt ? 'Generating...' : 'Generate System Prompt'}
                      </button>
                    </div>
                  )}

                  <textarea value={settings.system_prompt} onChange={(e) => updateSetting('system_prompt', e.target.value)} rows={10} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Instructions for how the agent should behave..." />
                  <p className="text-[10px] text-slate-400 mt-1">This prompt is used in Retell agent configuration. Include business details, services, pricing, and behavioral guidelines.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Greeting Message</label>
                  <input type="text" value={settings.greeting_message} onChange={(e) => updateSetting('greeting_message', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Hi, thank you for calling! How can I help you today?" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-indigo-500" /> Agent Capabilities</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'can_check_availability' as const, label: 'Check Calendar Availability', desc: 'Query Google Calendar free/busy slots' },
                  { key: 'can_book_meetings' as const, label: 'Book Meetings', desc: 'Create appointments on Google Calendar' },
                  { key: 'can_transfer_calls' as const, label: 'Transfer Calls', desc: 'Transfer to a live agent (requires Retell config)' },
                  { key: 'can_send_sms' as const, label: 'Send SMS', desc: 'Send text confirmations (requires Twilio)' },
                ].map(cap => (
                  <label key={cap.key} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={settings[cap.key]} onChange={(e) => updateSetting(cap.key, e.target.checked)} className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <div>
                      <span className="text-sm font-medium text-slate-700">{cap.label}</span>
                      <p className="text-xs text-slate-400">{cap.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" /> Booking Configuration</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Meeting Duration (min)</label>
                  <input type="number" value={settings.default_meeting_duration} onChange={(e) => updateSetting('default_meeting_duration', parseInt(e.target.value) || 30)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" min={15} max={120} step={15} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Buffer Between Meetings (min)</label>
                  <input type="number" value={settings.booking_buffer_minutes} onChange={(e) => updateSetting('booking_buffer_minutes', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" min={0} max={60} step={5} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Max Advance Booking (days)</label>
                  <input type="number" value={settings.max_advance_booking_days} onChange={(e) => updateSetting('max_advance_booking_days', parseInt(e.target.value) || 30)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" min={1} max={90} />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-2">Meeting Types</label>
                <div className="flex gap-3">
                  {['phone', 'video', 'in_person'].map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={settings.allowed_meeting_types.includes(type)} onChange={() => toggleMeetingType(type)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700 capitalize">{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
                <select value={settings.timezone} onChange={(e) => updateSetting('timezone', e.target.value)} className="w-full md:w-72 px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <button onClick={() => setShowBusinessHours(!showBusinessHours)} className="w-full flex items-center justify-between text-sm font-semibold text-slate-700">
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> Business Hours</span>
                {showBusinessHours ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showBusinessHours && (
                <div className="mt-4 space-y-3">
                  {Object.entries(DAY_NAMES).map(([day, name]) => {
                    const isEnabled = !!settings.business_hours[day];
                    return (
                      <div key={day} className="flex items-center gap-4">
                        <label className="flex items-center gap-2 w-32 cursor-pointer">
                          <input type="checkbox" checked={isEnabled} onChange={() => toggleBusinessDay(day)} className="rounded border-slate-300 text-indigo-600" />
                          <span className="text-sm text-slate-700">{name}</span>
                        </label>
                        {isEnabled ? (
                          <div className="flex items-center gap-2">
                            <input type="time" value={settings.business_hours[day].start} onChange={(e) => updateBusinessHours(day, 'start', e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-sm" />
                            <span className="text-xs text-slate-400">to</span>
                            <input type="time" value={settings.business_hours[day].end} onChange={(e) => updateBusinessHours(day, 'end', e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-sm" />
                          </div>
                        ) : <span className="text-xs text-slate-400">Closed</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <button onClick={() => setShowWebhooks(!showWebhooks)} className="w-full flex items-center justify-between text-sm font-semibold text-slate-700">
                <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-indigo-500" /> Webhook URLs (for Retell AI Configuration)</span>
                {showWebhooks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showWebhooks && (
                <div className="mt-4 space-y-4">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-xs text-indigo-700">Copy these URLs into your Retell AI dashboard.</p>
                  </div>
                  {webhookUrls && Object.entries(webhookUrls).map(([key, url]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">{key.replace(/_/g, ' ')}</label>
                        <div className="flex items-center gap-2">
                          <input type="text" value={String(url)} readOnly className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono" />
                          <button onClick={() => copyToClipboard(String(url))} className="p-2 text-slate-500 hover:text-indigo-600" title="Copy URL"><Copy className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" />
                Retell Custom Functions (copy into Retell)
              </h2>
              <p className="text-xs text-slate-600 mb-2">
                Paste this into Retell's Custom Functions to enable live availability checks and booking via your connected Google Calendar.
              </p>
              <textarea
                readOnly
                value={functionsJson}
                className="w-full font-mono text-xs p-3 border border-slate-300 rounded-lg bg-slate-50"
                rows={8}
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <button onClick={() => setShowEvents(!showEvents)} className="w-full flex items-center justify-between text-sm font-semibold text-slate-700">
                <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-indigo-500" /> Recent Webhook Events ({webhookEvents.length})</span>
                {showEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showEvents && (
                <div className="mt-4">
                  {webhookEvents.length === 0 ? <p className="text-xs text-slate-400 py-4 text-center">No webhook events yet.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-2 text-slate-500 font-medium">Event</th>
                            <th className="text-left py-2 px-2 text-slate-500 font-medium">Call ID</th>
                            <th className="text-left py-2 px-2 text-slate-500 font-medium">Status</th>
                            <th className="text-left py-2 px-2 text-slate-500 font-medium">Duration</th>
                            <th className="text-left py-2 px-2 text-slate-500 font-medium">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {webhookEvents.map(event => (
                            <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2 px-2 font-mono">{event.event_type}</td>
                              <td className="py-2 px-2 text-slate-500">{event.external_id ? event.external_id.slice(0, 12) + '...' : '—'}</td>
                              <td className="py-2 px-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${event.status === 'completed' ? 'bg-green-100 text-green-700' : event.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{event.status}</span>
                              </td>
                              <td className="py-2 px-2 text-slate-500">{event.duration_ms ? `${event.duration_ms}ms` : '—'}</td>
                              <td className="py-2 px-2 text-slate-500">{new Date(event.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.is_active} onChange={(e) => updateSetting('is_active', e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <div>
                    <span className="text-sm font-medium text-slate-700">Agent Active</span>
                    <p className="text-xs text-slate-400">When disabled, the agent will not process availability checks or bookings</p>
                  </div>
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => fetchSettings(selectedClientId)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
                  <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAgentSettings;