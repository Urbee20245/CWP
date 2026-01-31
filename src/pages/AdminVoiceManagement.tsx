"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import { supabase } from '../integrations/supabase/client';
import {
    Bot, Phone, Zap, Search, Loader2, CheckCircle2, AlertTriangle,
    Info, Globe, Clock, Plus, Power, PowerOff, RefreshCw, Save
} from 'lucide-react';

interface Client {
    id: string;
    business_name: string;
    phone: string;
    voice_status: string;
    number_source: string;
    a2p_status: string;
    twilio_configured: boolean;
    twilio_phone: string | null;
    retell_agent_id: string;
    phone_number: string | null;
    connection_method: string;
}

type SavedVoiceIntegration = {
    client_id: string;
    retell_agent_id: string | null;
    phone_number: string | null;
    number_source: 'client' | 'platform' | string | null;
    voice_status: string | null;
    a2p_status: string | null;
    updated_at?: string | null;
};

const AdminVoiceManagement: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProvisioning, setIsProvisioning] = useState(false);
    const [isDisabling, setIsDisabling] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

    // Form State
    const [retellAgentId, setRetellAgentId] = useState('');
    const [platformNumber, setPlatformNumber] = useState('');

    // Save state
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [configSaved, setConfigSaved] = useState(false);

    const [isUpdatingA2P, setIsUpdatingA2P] = useState(false);

    // Ref to track last loaded DB value to prevent resetting user input
    const lastLoadedAgentIdRef = useRef('');
    const lastLoadedPlatformNumberRef = useRef('');
    const prevSelectedClientIdRef = useRef<string>('');

    const showFeedback = (type: 'success' | 'error' | 'info', text: string, durationMs = 8000) => {
        setFeedbackMessage({ type, text });
        setTimeout(() => setFeedbackMessage(null), durationMs);
    };

    const mapClientData = (rawClients: any[]) => {
        return rawClients.map((c: any) => {
            const twilioIntegration = c.client_integrations?.find?.((i: any) => i.provider === 'twilio');
            const hasTwilioCredentials = !!(
                twilioIntegration?.account_sid_encrypted &&
                twilioIntegration?.auth_token_encrypted &&
                twilioIntegration?.phone_number
            );
            const voiceData = Array.isArray(c.client_voice_integrations)
                ? c.client_voice_integrations[0]
                : c.client_voice_integrations;

            return {
                id: c.id,
                business_name: c.business_name || 'Unknown',
                phone: c.phone || '',
                voice_status: voiceData?.voice_status || 'inactive',
                number_source: voiceData?.number_source || (hasTwilioCredentials ? 'client' : 'platform'),
                a2p_status: voiceData?.a2p_status || 'not_started',
                retell_agent_id: voiceData?.retell_agent_id || '',
                twilio_configured: hasTwilioCredentials,
                twilio_phone: twilioIntegration?.phone_number || null,
                phone_number: voiceData?.phone_number || twilioIntegration?.phone_number || null,
                connection_method: twilioIntegration?.connection_method || 'none',
            };
        });
    };

    const fetchClients = useCallback(async () => {
        setIsLoading(true);

        try {
            // Prefer direct query (works for admins via RLS policies) so the UI doesn't depend on edge function deployment.
            const { data, error } = await supabase
                .from('clients')
                .select(`
                    id,
                    business_name,
                    phone,
                    client_voice_integrations (
                        voice_status,
                        number_source,
                        a2p_status,
                        retell_agent_id,
                        phone_number,
                        retell_phone_id
                    ),
                    client_integrations (
                        provider,
                        phone_number,
                        account_sid_encrypted,
                        auth_token_encrypted,
                        connection_method
                    )
                `)
                .order('business_name', { ascending: true });

            if (error) throw error;

            setClients(mapClientData(data || []));
            return;
        } catch (directErr: any) {
            console.warn('[AdminVoiceManagement] Direct clients query failed, trying edge function:', directErr?.message);
        }

        try {
            const clientsData = await AdminService.getVoiceClients();
            setClients(mapClientData(clientsData || []));
        } catch (edgeFnErr: any) {
            console.warn('[AdminVoiceManagement] Edge function failed:', edgeFnErr.message);

            // IMPORTANT: Do NOT overwrite the existing client list with an "empty" fallback.
            // That fallback was clearing saved values from the UI. We keep the last known data instead.
            if (clients.length === 0) {
                showFeedback('error', 'Unable to load clients right now. Please try again in a moment.');
            } else {
                showFeedback('info', 'Live voice data is temporarily unavailable. Showing last loaded values.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [clients.length]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    const filteredClients = clients.filter(c =>
        c.business_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedClient = clients.find(c => c.id === selectedClientId);

    const isClientOwned = selectedClient?.twilio_configured === true;
    const isPlatformOwned = !isClientOwned;
    const effectiveSource = isClientOwned ? 'client' : 'platform';
    const isVoiceActive = selectedClient?.voice_status === 'active';

    // --- Sync form fields from DB (never clear existing inputs just because a refresh failed) ---
    useEffect(() => {
        if (!selectedClientId) return;

        const selectionChanged = prevSelectedClientIdRef.current !== selectedClientId;
        prevSelectedClientIdRef.current = selectedClientId;

        const client = clients.find(c => c.id === selectedClientId);
        const clientIsClientOwned = client?.twilio_configured === true;
        const clientIsPlatformOwned = !clientIsClientOwned;

        if (selectionChanged) {
            setFeedbackMessage(null);
            setConfigSaved(false);
        }

        const newAgentId = client?.retell_agent_id || '';
        if (selectionChanged) {
            setRetellAgentId(newAgentId);
            lastLoadedAgentIdRef.current = newAgentId;
        } else {
            // On background refresh: only update when we got a real (non-empty) value.
            if (newAgentId && newAgentId !== lastLoadedAgentIdRef.current) {
                setRetellAgentId(newAgentId);
                lastLoadedAgentIdRef.current = newAgentId;
            }
        }

        const newPlatformNumber = (client?.phone_number && client.number_source === 'platform')
            ? client.phone_number
            : '';
        if (selectionChanged) {
            setPlatformNumber(newPlatformNumber);
            lastLoadedPlatformNumberRef.current = newPlatformNumber;
        } else {
            if (newPlatformNumber && newPlatformNumber !== lastLoadedPlatformNumberRef.current) {
                setPlatformNumber(newPlatformNumber);
                lastLoadedPlatformNumberRef.current = newPlatformNumber;
            }
        }

        // Determine persisted state based on last-known persisted values (not on possibly-missing refresh data)
        const hasAgent = !!lastLoadedAgentIdRef.current;
        const hasPlatformPhone = clientIsPlatformOwned ? !!lastLoadedPlatformNumberRef.current : true;
        setConfigSaved(hasAgent && hasPlatformPhone);
    }, [selectedClientId, clients]);

    const hasAgentIdInput = !!retellAgentId.trim();
    const hasPlatformNumberInput = !!platformNumber.trim();

    const canSave = isClientOwned
        ? hasAgentIdInput
        : (hasAgentIdInput && hasPlatformNumberInput);

    // Enable should NOT require A2P approval anymore. If A2P is pending, backend will mark as pending.
    const canEnable = configSaved && !isVoiceActive;

    const applySavedVoiceIntegrationToLocalState = (voice: SavedVoiceIntegration) => {
        if (voice.retell_agent_id) {
            lastLoadedAgentIdRef.current = voice.retell_agent_id;
            setRetellAgentId(voice.retell_agent_id);
        }
        if (voice.phone_number) {
            lastLoadedPlatformNumberRef.current = voice.phone_number;
            setPlatformNumber(voice.phone_number);
        }

        setClients((prev) => prev.map((c) => {
            if (c.id !== voice.client_id) return c;
            return {
                ...c,
                retell_agent_id: (voice.retell_agent_id ?? c.retell_agent_id) || '',
                phone_number: voice.phone_number ?? c.phone_number,
                number_source: (voice.number_source ?? c.number_source) || c.number_source,
                voice_status: (voice.voice_status ?? c.voice_status) || c.voice_status,
                a2p_status: (voice.a2p_status ?? c.a2p_status) || c.a2p_status,
            };
        }));

        const savedHasAgent = !!voice.retell_agent_id;
        const savedHasPhone = isPlatformOwned ? !!voice.phone_number : true;
        setConfigSaved(savedHasAgent && savedHasPhone);
    };

    const handleSaveConfig = async () => {
        if (!selectedClientId || !canSave) return;

        setIsSavingConfig(true);
        setFeedbackMessage(null);

        try {
            const result = await AdminService.saveRetellAgentId(
                selectedClientId,
                retellAgentId.trim(),
                effectiveSource,
                isPlatformOwned ? platformNumber.trim() : undefined
            );

            if (result?.voice_integration) {
                applySavedVoiceIntegrationToLocalState(result.voice_integration as SavedVoiceIntegration);
            } else {
                // Fallback: mark saved based on inputs
                lastLoadedAgentIdRef.current = retellAgentId.trim();
                if (isPlatformOwned) lastLoadedPlatformNumberRef.current = platformNumber.trim();
                setConfigSaved(true);
            }

            showFeedback('success', 'Configuration saved successfully.', 5000);
            // Refresh in background; if it fails, we will not wipe state.
            fetchClients();
        } catch (e: any) {
            showFeedback('error', `Save Failed: ${e.message}`);
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleEnableVoice = async () => {
        if (!selectedClientId || !canEnable) return;

        setIsProvisioning(true);
        setFeedbackMessage(null);

        try {
            const result = await AdminService.provisionVoiceNumber(
                selectedClientId,
                effectiveSource,
                effectiveSource === 'platform' ? platformNumber.trim() : undefined,
                undefined,
                retellAgentId.trim()
            );

            if (result?.pending) {
                showFeedback('success', result.message || 'Enabled (pending A2P approval).');
            } else {
                showFeedback('success', 'AI Call Handling successfully enabled!');
            }

            await fetchClients();
        } catch (e: any) {
            showFeedback('error', e.message || 'Provisioning failed.');
        } finally {
            setIsProvisioning(false);
        }
    };

    const handleDisableVoice = async () => {
        if (!selectedClientId || !isVoiceActive) return;
        if (!confirm('Are you sure you want to disable AI Call Handling for this client? This will remove the phone number from Retell AI.')) return;

        setIsDisabling(true);
        setFeedbackMessage(null);

        try {
            await AdminService.disableVoice(selectedClientId);
            showFeedback('success', 'AI Call Handling disabled.');
            await fetchClients();
        } catch (e: any) {
            showFeedback('error', `Disable failed: ${e.message}`);
        } finally {
            setIsDisabling(false);
        }
    };

    const handleUpdateA2PStatus = async (newStatus: string) => {
        if (!selectedClientId) return;
        setIsUpdatingA2P(true);

        try {
            await AdminService.updateA2PStatus(selectedClientId, newStatus);
            showFeedback('success', `A2P status updated to "${newStatus}".`, 3000);
            await fetchClients();
        } catch (e: any) {
            showFeedback('error', `Failed to update A2P status: ${e.message}`);
        } finally {
            setIsUpdatingA2P(false);
        }
    };

    const getA2PStatusDisplay = (status: string) => {
        switch (status) {
            case 'approved': return { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200', icon: CheckCircle2 };
            case 'pending_approval': return { label: 'Under Review', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200', icon: Clock };
            case 'rejected': return { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200', icon: AlertTriangle };
            default: return { label: 'Not Started', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: Info };
        }
    };

    const getVoiceStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-100 text-emerald-700';
            case 'failed': return 'bg-red-100 text-red-700';
            case 'pending': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-500';
        }
    };

    const steps = selectedClient ? (() => {
        const s: { label: string; done: boolean; description: string }[] = [];
        if (isClientOwned) {
            s.push({
                label: 'Twilio Credentials',
                done: selectedClient.twilio_configured,
                description: selectedClient.twilio_configured
                    ? `Phone: ${selectedClient.twilio_phone}`
                    : 'Client needs to enter Twilio credentials in their Settings page',
            });
        } else {
            s.push({
                label: 'A2P Compliance',
                done: selectedClient.a2p_status === 'approved',
                description: selectedClient.a2p_status === 'approved'
                    ? 'Business verified'
                    : selectedClient.a2p_status === 'pending_approval'
                        ? 'Client submitted — awaiting your review'
                        : 'Not approved yet (you can still save + enable; activation will be pending)',
            });
        }

        s.push({
            label: 'Configuration Saved',
            done: configSaved,
            description: configSaved
                ? 'Agent ID (and platform phone number if needed) saved'
                : 'Enter values and click Save',
        });

        s.push({
            label: 'AI Calls Active',
            done: isVoiceActive,
            description: isVoiceActive
                ? 'AI Call Handling is live'
                : (selectedClient.voice_status === 'pending')
                    ? 'Pending — will auto-activate after A2P is approved'
                    : 'Ready to enable once saved',
        });

        return s;
    })() : [];

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Bot className="w-8 h-8 text-indigo-600" /> AI Call Management
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Client List */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-[650px] flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold">Select Client</h2>
                                <button onClick={() => fetchClients()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Refresh">
                                    <RefreshCw className={`w-4 h-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search businesses..."
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                {isLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" /></div>
                                ) : filteredClients.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-8">No clients found.</p>
                                ) : (
                                    filteredClients.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedClientId(c.id)}
                                            className={`w-full text-left p-3 rounded-lg border transition-all ${selectedClientId === c.id ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-100 hover:bg-slate-50'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <p className="font-bold text-slate-900 text-sm truncate">{c.business_name}</p>
                                                    {c.twilio_configured && (
                                                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase flex-shrink-0 ${c.connection_method === 'twilio_connect' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {c.connection_method === 'twilio_connect' ? 'Connected' : 'Twilio'}
                                                        </span>
                                                    )}
                                                </div>
                                                {c.voice_status === 'active' && <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500 flex-shrink-0" />}
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                                                    {c.twilio_configured ? 'client number' : 'platform number'}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase ${c.voice_status === 'active' ? 'text-emerald-600' : c.voice_status === 'failed' ? 'text-red-500' : c.voice_status === 'pending' ? 'text-amber-600' : 'text-slate-400'}`}>
                                                    {c.voice_status}
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Management Panel */}
                    <div className="lg:col-span-2 space-y-6">
                        {selectedClient ? (
                            <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 animate-fade-in">

                                {/* Header */}
                                <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">{selectedClient.business_name}</h2>
                                        <p className="text-slate-500 mt-1 flex items-center gap-2">
                                            <Phone className="w-4 h-4" />
                                            {selectedClient.phone || 'No phone on record'}
                                        </p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest ${getVoiceStatusBadge(selectedClient.voice_status)}`}>
                                        {selectedClient.voice_status}
                                    </div>
                                </div>

                                {/* Sourcing Mode Indicator */}
                                <div className={`p-4 mb-6 rounded-xl border flex items-center gap-3 ${isClientOwned ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
                                    {isClientOwned ? (
                                        <>
                                            <Plus className="w-5 h-5 text-purple-600" />
                                            <div>
                                                <p className="font-bold text-sm text-purple-700">
                                                    {selectedClient.connection_method === 'twilio_connect'
                                                        ? 'Client Twilio (Connected via OAuth)'
                                                        : 'Client-Owned Twilio Number'}
                                                </p>
                                                <p className="text-xs mt-0.5 text-purple-600">
                                                    {selectedClient.connection_method === 'twilio_connect'
                                                        ? `Twilio Connect authorized. Phone: `
                                                        : `Client entered credentials. Phone: `}
                                                    <span className="font-mono font-semibold">{selectedClient.twilio_phone}</span>
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Globe className="w-5 h-5 text-blue-600" />
                                            <div>
                                                <p className="font-bold text-sm text-blue-700">Option 1: Done-For-You (Platform-Managed)</p>
                                                <p className="text-xs mt-0.5 text-blue-600">
                                                    We handle everything. You can save + enable now; if A2P isn't approved yet, it will stay pending.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Progress Steps */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Setup Progress</h3>
                                    <div className="space-y-3">
                                        {steps.map((step, i) => (
                                            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${step.done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>
                                                    {step.done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${step.done ? 'text-emerald-700' : 'text-slate-700'}`}>{step.label}</p>
                                                    <p className={`text-xs mt-0.5 ${step.done ? 'text-emerald-600' : 'text-slate-500'}`}>{step.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* A2P Admin Controls (Platform-Owned only) */}
                                {isPlatformOwned && (
                                    <div className="mb-6">
                                        {(() => {
                                            const a2pDisplay = getA2PStatusDisplay(selectedClient.a2p_status);
                                            return (
                                                <div className={`p-4 rounded-xl border ${a2pDisplay.bg} ${a2pDisplay.border}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <a2pDisplay.icon className={`w-5 h-5 ${a2pDisplay.color}`} />
                                                            <div>
                                                                <p className={`font-bold text-sm ${a2pDisplay.color}`}>A2P Compliance: {a2pDisplay.label}</p>
                                                                {selectedClient.a2p_status !== 'approved' && (
                                                                    <p className="text-xs mt-0.5 text-slate-600">You can still save + enable now; it will stay pending until approved.</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {selectedClient.a2p_status !== 'approved' && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateA2PStatus('approved')}
                                                                    disabled={isUpdatingA2P}
                                                                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                                                >
                                                                    {isUpdatingA2P ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                                                                </button>
                                                                {selectedClient.a2p_status === 'pending_approval' && (
                                                                    <button
                                                                        onClick={() => handleUpdateA2PStatus('rejected')}
                                                                        disabled={isUpdatingA2P}
                                                                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {selectedClient.a2p_status === 'approved' && (
                                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-200 px-2 py-1 rounded">Verified</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Configuration */}
                                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 mb-6">
                                    <h4 className="font-bold text-indigo-800 text-sm flex items-center gap-2 mb-3">
                                        <Bot className="w-4 h-4" /> Retell AI Configuration
                                    </h4>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-indigo-800 mb-2">Retell Agent ID</label>
                                            <input
                                                type="text"
                                                placeholder="agent_xxxxxxxxxxxxxxxx"
                                                className="w-full p-3 border border-indigo-300 rounded-lg text-sm font-mono bg-white"
                                                value={retellAgentId}
                                                onChange={(e) => {
                                                    setRetellAgentId(e.target.value);
                                                    setConfigSaved(false);
                                                }}
                                            />
                                        </div>

                                        {isPlatformOwned && (
                                            <div>
                                                <label className="block text-xs font-semibold text-indigo-800 mb-2">Platform Phone Number (E.164)</label>
                                                <input
                                                    type="text"
                                                    placeholder="+14045551234"
                                                    className="w-full p-3 border border-indigo-300 rounded-lg text-sm font-mono bg-white"
                                                    value={platformNumber}
                                                    onChange={(e) => {
                                                        setPlatformNumber(e.target.value);
                                                        setConfigSaved(false);
                                                    }}
                                                />
                                            </div>
                                        )}

                                        <button
                                            onClick={handleSaveConfig}
                                            disabled={isSavingConfig || !canSave}
                                            className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${configSaved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                        >
                                            {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : configSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                            {configSaved ? 'Saved' : 'Save'}
                                        </button>

                                        {configSaved && (
                                            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                                <div className="font-semibold">Saved values</div>
                                                <div className="mt-1 font-mono">Agent ID: {lastLoadedAgentIdRef.current}</div>
                                                {isPlatformOwned && <div className="mt-1 font-mono">Phone: {lastLoadedPlatformNumberRef.current}</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Feedback Message */}
                                {feedbackMessage && (
                                    <div className={`p-3 mb-4 rounded-lg text-sm flex items-center gap-2 ${
                                        feedbackMessage.type === 'success' ? 'bg-emerald-100 border border-emerald-300 text-emerald-800' :
                                        feedbackMessage.type === 'error' ? 'bg-red-100 border border-red-300 text-red-800' :
                                        'bg-blue-100 border border-blue-300 text-blue-800'
                                    }`}>
                                        {feedbackMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                                        <span>{feedbackMessage.text}</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    {!isVoiceActive ? (
                                        <button
                                            onClick={handleEnableVoice}
                                            disabled={isProvisioning || !canEnable}
                                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                                        >
                                            {isProvisioning ? (
                                                <>
                                                    <Loader2 className="w-6 h-6 animate-spin" />
                                                    Enabling AI Calls...
                                                </>
                                            ) : (
                                                <>
                                                    <Power className="w-6 h-6" />
                                                    Enable AI Call Handling
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3">
                                                <CheckCircle2 className="w-6 h-6" />
                                                AI Call Handling Active
                                            </div>
                                            <button
                                                onClick={handleDisableVoice}
                                                disabled={isDisabling}
                                                className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                {isDisabling ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Disabling...
                                                    </>
                                                ) : (
                                                    <>
                                                        <PowerOff className="w-4 h-4" />
                                                        Disable AI Call Handling
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {!isVoiceActive && !canEnable && (
                                        <p className="text-xs text-slate-500 text-center">
                                            Save the configuration above first.
                                        </p>
                                    )}
                                </div>

                                <p className="text-center text-[10px] text-slate-400 mt-6 uppercase tracking-[0.2em]">
                                    Custom Websites Plus — AI Voice Automation
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white p-20 rounded-xl shadow-lg border border-slate-100 flex flex-col items-center text-center">
                                <Bot className="w-16 h-16 text-slate-200 mb-4" />
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to Manage</h3>
                                <p className="text-slate-500 max-w-sm">Select a client from the list to configure their AI call handling.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminVoiceManagement;