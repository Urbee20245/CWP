"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Bot, Phone, Zap, Search, Loader2, CheckCircle2, AlertTriangle, Info, Plus, Shield, Globe, Clock } from 'lucide-react';
import { AdminService } from '../services/adminService';

interface Client {
    id: string;
    business_name: string;
    phone: string;
    voice_status?: string;
    number_source?: string;
    a2p_status?: string;
    twilio_configured?: boolean;
    twilio_phone?: string;
    retell_agent_id?: string;
}

const AdminVoiceManagement: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProvisioning, setIsProvisioning] = useState(false);
    const [provisioningError, setProvisioningError] = useState<string | null>(null);
    
    // Form State
    const [source, setSource] = useState<'client' | 'platform'>('client');
    const [platformNumber, setPlatformNumber] = useState('');
    const [retellAgentId, setRetellAgentId] = useState('');
    const [isSavingAgentId, setIsSavingAgentId] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false); // Feedback state
    const [a2pData, setA2pData] = useState({
        legal_name: '',
        website: '',
        use_case: '',
        sample_sms: 'Hi, this is [Name] confirming your appointment for tomorrow at [Time].'
    });

    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        const { data: clientsData, error: fetchError } = await supabase
            .from('clients')
            .select(`
                id, business_name, phone,
                client_voice_integrations (voice_status, number_source, a2p_status, retell_agent_id),
                client_integrations (provider, phone_number)
            `)
            .order('business_name', { ascending: true });

        if (fetchError) {
            console.error('[AdminVoiceManagement] Error fetching clients:', fetchError);
        }

        const formatted = (clientsData || []).map((c: any) => {
            const twilioIntegration = c.client_integrations?.find((i: any) => i.provider === 'twilio');

            return {
                ...c,
                voice_status: c.client_voice_integrations?.[0]?.voice_status || 'inactive',
                // Use 'client' as fallback if Twilio is configured, otherwise 'platform'
                number_source: c.client_voice_integrations?.[0]?.number_source || (twilioIntegration ? 'client' : 'platform'),
                a2p_status: c.client_voice_integrations?.[0]?.a2p_status || 'not_started',
                retell_agent_id: c.client_voice_integrations?.[0]?.retell_agent_id || '',
                twilio_configured: !!twilioIntegration,
                twilio_phone: twilioIntegration?.phone_number || null,
            };
        });

        setClients(formatted);
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    useEffect(() => {
        if (selectedClientId) {
            const client = clients.find(c => c.id === selectedClientId);
            setRetellAgentId(client?.retell_agent_id || '');
            setSaveSuccess(false);
        }
    }, [selectedClientId, clients]);

    const filteredClients = clients.filter(c => 
        c.business_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedClient = clients.find(c => c.id === selectedClientId);
    
    const isClientOwned = selectedClient?.number_source === 'client';
    const isA2PPending = isClientOwned && selectedClient?.a2p_status !== 'approved';
    const isA2PApproved = isClientOwned && selectedClient?.a2p_status === 'approved';
    const isVoiceActive = selectedClient?.voice_status === 'active';

    const handleSaveAgentId = async () => {
        if (!selectedClientId || !retellAgentId.trim()) return;
        setIsSavingAgentId(true);
        setSaveSuccess(false);

        try {
            const { data: existing } = await supabase
                .from('client_voice_integrations')
                .select('*')
                .eq('client_id', selectedClientId)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('client_voice_integrations')
                    .update({
                        retell_agent_id: retellAgentId.trim(),
                    })
                    .eq('client_id', selectedClientId);

                if (error) throw error;
            } else {
                // Determine source based on Twilio configuration
                const currentSource = selectedClient?.twilio_configured ? 'client' : 'platform';
                
                const { error } = await supabase
                    .from('client_voice_integrations')
                    .insert({
                        client_id: selectedClientId,
                        retell_agent_id: retellAgentId.trim(),
                        number_source: currentSource,
                        voice_status: 'inactive',
                        a2p_status: 'not_started',
                    });

                if (error) throw error;
            }

            setSaveSuccess(true);
            await fetchClients(); // Refresh data
        } catch (e: any) {
            setProvisioningError(`Failed to save Agent ID: ${e.message}`);
        } finally {
            setIsSavingAgentId(false);
        }
    };

    const handleEnableVoice = async () => {
        if (!selectedClientId) return;

        if (!retellAgentId.trim()) {
            setProvisioningError("Please enter the Retell Agent ID for this client first.");
            return;
        }

        setIsProvisioning(true);
        setProvisioningError(null);

        try {
            await AdminService.provisionVoiceNumber(
                selectedClientId,
                source,
                source === 'platform' ? platformNumber : undefined,
                source === 'platform' ? a2pData : undefined,
                retellAgentId.trim()
            );
            alert("AI Call Handling successfully enabled for this client!");
            fetchClients();
        } catch (e: any) {
            if (e.message.includes('422')) {
                setProvisioningError("Provisioning skipped: A2P approval is still pending for this client-owned number.");
            } else {
                setProvisioningError(`Provisioning Failed: ${e.message}`);
            }
        } finally {
            setIsProvisioning(false);
        }
    };
    
    const getA2PStatusDisplay = (status: string) => {
        switch (status) {
            case 'approved': return { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 };
            case 'pending_approval':
            case 'submitted': return { label: 'Pending Approval', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock };
            case 'rejected': return { label: 'Needs Attention', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle };
            default: return { label: 'Not Started', color: 'text-slate-600', bg: 'bg-slate-100', icon: Info };
        }
    };

    const a2pDisplay = selectedClient ? getA2PStatusDisplay(selectedClient.a2p_status || 'not_started') : null;

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Bot className="w-8 h-8 text-indigo-600" /> AI Call Management
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-[600px] flex flex-col">
                            <h2 className="text-xl font-bold mb-4">Select Client</h2>
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
                                ) : (
                                    filteredClients.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedClientId(c.id)}
                                            className={`w-full text-left p-3 rounded-lg border transition-all ${selectedClientId === c.id ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-100 hover:bg-slate-50'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-900 text-sm">{c.business_name}</p>
                                                    {c.twilio_configured && (
                                                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold rounded uppercase">Twilio</span>
                                                    )}
                                                </div>
                                                {c.voice_status === 'active' && <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />}
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{c.number_source} number</span>
                                                <span className={`text-[10px] font-bold uppercase ${c.voice_status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {c.voice_status}
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        {selectedClient ? (
                            <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 animate-fade-in">
                                <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-8">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">{selectedClient.business_name}</h2>
                                        <p className="text-slate-500 mt-1 flex items-center gap-2">
                                            <Phone className="w-4 h-4" /> 
                                            {selectedClient.phone || 'No phone on record'}
                                        </p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest ${isVoiceActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        Voice Status: {selectedClient.voice_status}
                                    </div>
                                </div>
                                
                                {/* RESTORED: Twilio configuration indicator */}
                                <div className={`p-4 mb-6 rounded-xl border flex items-center gap-3 ${selectedClient.twilio_configured ? 'bg-purple-50 border-purple-200' : 'bg-amber-50 border-amber-200'}`}>
                                    {selectedClient.twilio_configured ? (
                                        <>
                                            <CheckCircle2 className="w-5 h-5 text-purple-600" />
                                            <div>
                                                <p className="font-bold text-sm text-purple-700">Twilio Credentials Ready</p>
                                                <p className="text-xs mt-0.5 text-purple-600">
                                                    Phone: <span className="font-mono font-semibold">{selectedClient.twilio_phone}</span> — Ready for Retell AI import
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                                            <div>
                                                <p className="font-bold text-sm text-amber-700">Twilio Credentials Not Configured</p>
                                                <p className="text-xs mt-0.5 text-amber-600">
                                                    Client has not entered their Twilio credentials yet. They must complete setup in their Client Settings page before you can import to Retell AI.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {isClientOwned && a2pDisplay && (
                                    <div className={`p-4 mb-6 rounded-xl border flex items-center gap-3 ${a2pDisplay.bg} border-current`}>
                                        <a2pDisplay.icon className={`w-5 h-5 ${a2pDisplay.color}`} />
                                        <div>
                                            <p className={`font-bold text-sm ${a2pDisplay.color}`}>
                                                Messaging Approval: {a2pDisplay.label}
                                            </p>
                                            {isA2PPending && (
                                                <p className="text-xs mt-0.5 text-blue-800">
                                                    AI Call Handling is disabled until A2P approval is granted. Provisioning will start automatically upon approval.
                                                </p>
                                            )}
                                            {isA2PApproved && !isVoiceActive && (
                                                <p className="text-xs mt-0.5 text-emerald-800">
                                                    A2P Approved. Click 'Enable AI Call Handling' below to finalize setup.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 mb-6">
                                    <h4 className="font-bold text-indigo-800 text-sm flex items-center gap-2 mb-3">
                                        <Bot className="w-4 h-4" /> Retell AI Agent Configuration
                                    </h4>
                                    <p className="text-xs text-indigo-700 mb-4">
                                        Enter the Retell Agent ID you created for this client. Each client needs their own custom agent in Retell AI.
                                    </p>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            placeholder="agent_xxxxxxxxxxxxxxxx"
                                            className="flex-1 p-3 border border-indigo-300 rounded-lg text-sm font-mono bg-white"
                                            value={retellAgentId}
                                            onChange={(e) => setRetellAgentId(e.target.value)}
                                        />
                                        <button
                                            onClick={handleSaveAgentId}
                                            disabled={isSavingAgentId || !retellAgentId.trim()}
                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                        >
                                            {isSavingAgentId ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                            {saveSuccess ? 'Saved!' : 'Save'}
                                        </button>
                                    </div>
                                    {selectedClient?.retell_agent_id && (
                                        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Agent ID saved: <span className="font-mono">{selectedClient.retell_agent_id}</span>
                                        </p>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-indigo-600" /> Sourcing Strategy
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                    <button 
                                        onClick={() => setSource('client')}
                                        type="button"
                                        className={`p-6 text-left rounded-xl border-2 transition-all group ${source === 'client' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${source === 'client' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                <Plus className="w-5 h-5" />
                                            </div>
                                            <span className="font-bold text-slate-900">Option A: Client-Owned</span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Use Twilio credentials provided by the client. Fully white-labeled. The client pays Twilio directly.
                                        </p>
                                    </button>

                                    <button 
                                        onClick={() => setSource('platform')}
                                        type="button"
                                        className={`p-6 text-left rounded-xl border-2 transition-all group ${source === 'platform' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${source === 'platform' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                <Globe className="w-5 h-5" />
                                            </div>
                                            <span className="font-bold text-slate-900">Option B: Platform-Owned</span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            "Done-For-You." We assign a number from our platform pool. We handle billing and A2P compliance.
                                        </p>
                                    </button>
                                </div>

                                {source === 'platform' && (
                                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-10 space-y-4">
                                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                            <Info className="w-4 h-4" /> A2P Registration Details
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned Number (E.164)</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="+1..." 
                                                    className="w-full p-2 border border-slate-300 rounded text-sm font-mono"
                                                    value={platformNumber}
                                                    onChange={(e) => setPlatformNumber(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Legal Business Name</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full p-2 border border-slate-300 rounded text-sm"
                                                    value={a2pData.legal_name}
                                                    onChange={(e) => setA2pData({...a2pData, legal_name: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {provisioningError && (
                                    <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {provisioningError}
                                    </div>
                                )}

                                <button
                                    onClick={handleEnableVoice}
                                    disabled={isProvisioning || isVoiceActive || (source === 'platform' && !platformNumber) || (source === 'client' && (isA2PPending || !selectedClient?.twilio_configured))}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isProvisioning ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            Enabling Secure AI Calls...
                                        </>
                                    ) : isVoiceActive ? (
                                        <>
                                            <CheckCircle2 className="w-6 h-6" />
                                            AI Call Handling Active
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-6 h-6 fill-current" />
                                            Enable AI Call Handling
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-[10px] text-slate-400 mt-4 uppercase tracking-[0.2em]">
                                    White-Label: Custom Websites Plus Automation
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white p-20 rounded-xl shadow-lg border border-slate-100 flex flex-col items-center text-center">
                                <Bot className="w-16 h-16 text-slate-200 mb-4" />
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to Provision</h3>
                                <p className="text-slate-500 max-w-sm">Select a client from the list to manage their AI call handling configuration.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminVoiceManagement;