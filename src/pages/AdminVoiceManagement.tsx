"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Bot, Phone, Zap, Search, Loader2, CheckCircle2, AlertTriangle, Info, Plus, Shield, Globe } from 'lucide-react';
import { AdminService } from '../services/adminService';

interface Client {
    id: string;
    business_name: string;
    phone: string;
    voice_status?: string;
    number_source?: string;
}

const AdminVoiceManagement: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProvisioning, setIsProvisioning] = useState(false);
    
    // Form State
    const [source, setSource] = useState<'client' | 'platform'>('client');
    const [platformNumber, setPlatformNumber] = useState('');
    const [a2pData, setA2pData] = useState({
        legal_name: '',
        website: '',
        use_case: '',
        sample_sms: 'Hi, this is [Name] confirming your appointment for tomorrow at [Time].'
    });

    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        const { data: clientsData } = await supabase
            .from('clients')
            .select(`
                id, business_name, phone,
                client_voice_integrations (voice_status, number_source)
            `)
            .order('business_name', { ascending: true });

        const formatted = (clientsData || []).map((c: any) => ({
            ...c,
            voice_status: c.client_voice_integrations?.[0]?.voice_status || 'inactive',
            number_source: c.client_voice_integrations?.[0]?.number_source || 'none'
        }));
        
        setClients(formatted);
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    const filteredClients = clients.filter(c => 
        c.business_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedClient = clients.find(c => c.id === selectedClientId);

    const handleEnableVoice = async () => {
        if (!selectedClientId) return;
        setIsProvisioning(true);

        try {
            await AdminService.provisionVoiceNumber(
                selectedClientId, 
                source, 
                source === 'platform' ? platformNumber : undefined,
                source === 'platform' ? a2pData : undefined
            );
            alert("AI Call Handling successfully enabled for this client!");
            fetchClients();
        } catch (e: any) {
            alert(`Provisioning Failed: ${e.message}`);
        } finally {
            setIsProvisioning(false);
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Bot className="w-8 h-8 text-indigo-600" /> AI Call Management
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Client Selector */}
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
                                            className={`w-full text-left p-3 rounded-lg border transition-all ${selectedClientId === c.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-100 hover:bg-slate-50'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className="font-bold text-slate-900 text-sm">{c.business_name}</p>
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

                    {/* Sourcing Panel */}
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
                                    <div className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest ${selectedClient.voice_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        Voice Status: {selectedClient.voice_status}
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-indigo-600" /> Sourcing Strategy
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                    <button 
                                        onClick={() => setSource('client')}
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
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Website URL</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full p-2 border border-slate-300 rounded text-sm"
                                                    value={a2pData.website}
                                                    onChange={(e) => setA2pData({...a2pData, website: e.target.value})}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Use Case Description</label>
                                                <textarea 
                                                    rows={2}
                                                    className="w-full p-2 border border-slate-300 rounded text-sm resize-none"
                                                    value={a2pData.use_case}
                                                    onChange={(e) => setA2pData({...a2pData, use_case: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={handleEnableVoice}
                                    disabled={isProvisioning || (source === 'platform' && !platformNumber)}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isProvisioning ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            Enabling Secure AI Calls...
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