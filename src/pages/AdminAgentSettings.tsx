"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import { supabase } from '../integrations/supabase/client';
import {
    Bot, Settings, Calendar, Phone, Globe, Clock, Save,
    Loader2, CheckCircle2, AlertTriangle, Info, Copy, ExternalLink,
    Shield, Zap, MessageSquare, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';

interface Client {
    id: string;
    business_name: string;
}

interface AgentSettings {
    id?: string;
    client_id: string;
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
        "1": { start: "09:00", end: "17:00" },
        "2": { start: "09:00", end: "17:00" },
        "3": { start: "09:00", end: "17:00" },
        "4": { start: "09:00", end: "17:00" },
        "5": { start: "09:00", end: "17:00" },
    },
    timezone: 'America/New_York',
    is_active: true,
};

const DAY_NAMES: Record<string, string> = {
    "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
    "4": "Thursday", "5": "Friday", "6": "Saturday",
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

    const showFeedback = (type: 'success' | 'error' | 'info', text: string) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 6000);
    };

    // Fetch clients list
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
                console.error('Failed to fetch clients:', err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClients();
    }, []);

    // Fetch agent settings when client changes
    const fetchSettings = useCallback(async (clientId: string) => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const result = await AdminService.getAgentSettings(clientId);
            if (result.settings) {
                setSettings({ ...DEFAULT_SETTINGS, ...result.settings, client_id: clientId });
            } else {
                setSettings({ ...DEFAULT_SETTINGS, client_id: clientId });
            }
            setWebhookUrls(result.webhook_urls || null);
            setWebhookEvents(result.recent_events || []);
            setIntegrations(result.integrations || null);
        } catch (err: any) {
            console.error('Failed to fetch agent settings:', err.message);
            setSettings({ ...DEFAULT_SETTINGS, client_id: clientId });
            showFeedback('error', `Failed to load settings: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

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

    const handleSave = async () => {
        if (!settings || !selectedClientId) return;
        setIsSaving(true);
        try {
            await AdminService.saveAgentSettings({
                client_id: selectedClientId,
                ...settings,
            });
            showFeedback('success', 'Agent settings saved successfully.');
        } catch (err: any) {
            showFeedback('error', `Failed to save: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const updateSetting = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
        if (!settings) return;
        setSettings({ ...settings, [key]: value });
    };

    const updateBusinessHours = (day: string, field: 'start' | 'end', value: string) => {
        if (!settings) return;
        const hours = { ...settings.business_hours };
        if (hours[day]) {
            hours[day] = { ...hours[day], [field]: value };
        } else {
            hours[day] = { start: '09:00', end: '17:00', [field]: value };
        }
        setSettings({ ...settings, business_hours: hours });
    };

    const toggleBusinessDay = (day: string) => {
        if (!settings) return;
        const hours = { ...settings.business_hours };
        if (hours[day]) {
            delete hours[day];
        } else {
            hours[day] = { start: '09:00', end: '17:00' };
        }
        setSettings({ ...settings, business_hours: hours });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showFeedback('info', 'Copied to clipboard.');
    };

    const toggleMeetingType = (type: string) => {
        if (!settings) return;
        const types = settings.allowed_meeting_types.includes(type)
            ? settings.allowed_meeting_types.filter(t => t !== type)
            : [...settings.allowed_meeting_types, type];
        updateSetting('allowed_meeting_types', types);
    };

    return (
        <AdminLayout>
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Bot className="w-7 h-7 text-indigo-600" />
                        AI Agent Settings
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Configure per-client AI agent behavior, capabilities, and webhook integrations for Retell AI.
                    </p>
                </div>

                {/* Feedback */}
                {feedback && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                        feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                        feedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                        'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                         feedback.type === 'error' ? <AlertTriangle className="w-5 h-5" /> :
                         <Info className="w-5 h-5" />}
                        <span className="text-sm">{feedback.text}</span>
                    </div>
                )}

                {/* Client Selector */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Client</label>
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full md:w-96 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="">-- Choose a client --</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.business_name}</option>
                        ))}
                    </select>
                </div>

                {isLoading && selectedClientId && (
                    <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading agent settings...</span>
                    </div>
                )}

                {settings && !isLoading && (
                    <>
                        {/* Integration Status Banner */}
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
                                        <p className="text-xs mt-1 text-slate-600">
                                            {integrations.google_calendar.connected
                                                ? `Connected (${integrations.google_calendar.calendar_id || 'primary'})`
                                                : 'Not connected — agent cannot check availability or book meetings'}
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-lg border ${integrations.retell.configured ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                                        <div className="flex items-center gap-2">
                                            <Phone className={`w-4 h-4 ${integrations.retell.configured ? 'text-green-600' : 'text-amber-600'}`} />
                                            <span className="text-sm font-medium">Retell AI</span>
                                        </div>
                                        <p className="text-xs mt-1 text-slate-600">
                                            {integrations.retell.configured
                                                ? `Agent: ${integrations.retell.agent_id} | ${integrations.retell.voice_status}`
                                                : 'No agent configured — set up in AI Voice management'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Agent Identity */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Bot className="w-4 h-4 text-indigo-500" />
                                Agent Identity
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Agent Name</label>
                                    <input
                                        type="text"
                                        value={settings.agent_name}
                                        onChange={(e) => updateSetting('agent_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. Luna, Alex, Reception AI"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">System Prompt</label>
                                    <textarea
                                        value={settings.system_prompt}
                                        onChange={(e) => updateSetting('system_prompt', e.target.value)}
                                        rows={6}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Instructions for how the agent should behave, what info to provide, tone of voice, etc."
                                    />
                                    <p className="text-xs text-slate-400 mt-1">
                                        This prompt is used in Retell agent configuration. Include business details, services, pricing, and behavioral guidelines.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Greeting Message</label>
                                    <input
                                        type="text"
                                        value={settings.greeting_message}
                                        onChange={(e) => updateSetting('greeting_message', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. Hi, thank you for calling! How can I help you today?"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Agent Capabilities */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-indigo-500" />
                                Agent Capabilities
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { key: 'can_check_availability' as const, label: 'Check Calendar Availability', desc: 'Query Google Calendar free/busy slots' },
                                    { key: 'can_book_meetings' as const, label: 'Book Meetings', desc: 'Create appointments on Google Calendar' },
                                    { key: 'can_transfer_calls' as const, label: 'Transfer Calls', desc: 'Transfer to a live agent (requires Retell config)' },
                                    { key: 'can_send_sms' as const, label: 'Send SMS', desc: 'Send text confirmations (requires Twilio)' },
                                ].map(cap => (
                                    <label key={cap.key} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings[cap.key]}
                                            onChange={(e) => updateSetting(cap.key, e.target.checked)}
                                            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-slate-700">{cap.label}</span>
                                            <p className="text-xs text-slate-400">{cap.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Booking Configuration */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-500" />
                                Booking Configuration
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Meeting Duration (min)</label>
                                    <input
                                        type="number"
                                        value={settings.default_meeting_duration}
                                        onChange={(e) => updateSetting('default_meeting_duration', parseInt(e.target.value) || 30)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        min={15} max={120} step={15}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Buffer Between Meetings (min)</label>
                                    <input
                                        type="number"
                                        value={settings.booking_buffer_minutes}
                                        onChange={(e) => updateSetting('booking_buffer_minutes', parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        min={0} max={60} step={5}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Max Advance Booking (days)</label>
                                    <input
                                        type="number"
                                        value={settings.max_advance_booking_days}
                                        onChange={(e) => updateSetting('max_advance_booking_days', parseInt(e.target.value) || 30)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        min={1} max={90}
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-600 mb-2">Meeting Types</label>
                                <div className="flex gap-3">
                                    {['phone', 'video', 'in_person'].map(type => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.allowed_meeting_types.includes(type)}
                                                onChange={() => toggleMeetingType(type)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-slate-700 capitalize">{type.replace('_', ' ')}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
                                <select
                                    value={settings.timezone}
                                    onChange={(e) => updateSetting('timezone', e.target.value)}
                                    className="w-full md:w-72 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                >
                                    {TIMEZONE_OPTIONS.map(tz => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Business Hours */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <button
                                onClick={() => setShowBusinessHours(!showBusinessHours)}
                                className="w-full flex items-center justify-between text-sm font-semibold text-slate-700"
                            >
                                <span className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    Business Hours
                                </span>
                                {showBusinessHours ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {showBusinessHours && (
                                <div className="mt-4 space-y-3">
                                    {Object.entries(DAY_NAMES).map(([day, name]) => {
                                        const isEnabled = !!settings.business_hours[day];
                                        return (
                                            <div key={day} className="flex items-center gap-4">
                                                <label className="flex items-center gap-2 w-32 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isEnabled}
                                                        onChange={() => toggleBusinessDay(day)}
                                                        className="rounded border-slate-300 text-indigo-600"
                                                    />
                                                    <span className="text-sm text-slate-700">{name}</span>
                                                </label>
                                                {isEnabled && (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={settings.business_hours[day].start}
                                                            onChange={(e) => updateBusinessHours(day, 'start', e.target.value)}
                                                            className="px-2 py-1 border border-slate-300 rounded text-sm"
                                                        />
                                                        <span className="text-xs text-slate-400">to</span>
                                                        <input
                                                            type="time"
                                                            value={settings.business_hours[day].end}
                                                            onChange={(e) => updateBusinessHours(day, 'end', e.target.value)}
                                                            className="px-2 py-1 border border-slate-300 rounded text-sm"
                                                        />
                                                    </div>
                                                )}
                                                {!isEnabled && (
                                                    <span className="text-xs text-slate-400">Closed</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Webhook URLs */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <button
                                onClick={() => setShowWebhooks(!showWebhooks)}
                                className="w-full flex items-center justify-between text-sm font-semibold text-slate-700"
                            >
                                <span className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-indigo-500" />
                                    Webhook URLs (for Retell AI Configuration)
                                </span>
                                {showWebhooks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {showWebhooks && (
                                <div className="mt-4 space-y-4">
                                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                        <p className="text-xs text-indigo-700">
                                            Copy these URLs into your Retell AI dashboard. The <strong>Retell Webhook</strong> receives call lifecycle events.
                                            The <strong>Check Availability</strong> and <strong>Book Meeting</strong> URLs are registered as Custom Functions
                                            that the agent calls mid-conversation.
                                        </p>
                                    </div>

                                    {webhookUrls && Object.entries(webhookUrls).map(([key, url]) => (
                                        <div key={key} className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">
                                                    {key.replace(/_/g, ' ')}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={url}
                                                        readOnly
                                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                                                    />
                                                    <button
                                                        onClick={() => copyToClipboard(url)}
                                                        className="p-2 text-slate-500 hover:text-indigo-600"
                                                        title="Copy URL"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {!webhookUrls && (
                                        <p className="text-xs text-slate-400">Webhook URLs will be generated after saving settings.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Recent Webhook Events */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <button
                                onClick={() => setShowEvents(!showEvents)}
                                className="w-full flex items-center justify-between text-sm font-semibold text-slate-700"
                            >
                                <span className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                                    Recent Webhook Events ({webhookEvents.length})
                                </span>
                                {showEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {showEvents && (
                                <div className="mt-4">
                                    {webhookEvents.length === 0 ? (
                                        <p className="text-xs text-slate-400 py-4 text-center">No webhook events yet. Events will appear here once Retell AI starts making calls.</p>
                                    ) : (
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
                                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                                    event.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                    event.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                                    'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                    {event.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-2 text-slate-500">{event.duration_ms ? `${event.duration_ms}ms` : '—'}</td>
                                                            <td className="py-2 px-2 text-slate-500">
                                                                {new Date(event.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Active Toggle + Save */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.is_active}
                                        onChange={(e) => updateSetting('is_active', e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div>
                                        <span className="text-sm font-medium text-slate-700">Agent Active</span>
                                        <p className="text-xs text-slate-400">When disabled, the agent will not process availability checks or bookings</p>
                                    </div>
                                </label>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => fetchSettings(selectedClientId)}
                                        className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                    >
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
