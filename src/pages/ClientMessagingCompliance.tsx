"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { 
    ShieldCheck, 
    Building2, 
    Globe, 
    User, 
    CheckCircle2, 
    Loader2, 
    AlertTriangle,
    Info,
    ArrowRight,
    Lock,
    Clock,
    MessageSquare
} from 'lucide-react';

interface A2PData {
    legal_name: string;
    business_type: string;
    ein: string;
    address_street: string;
    address_city: string;
    address_state: string;
    address_zip: string;
    website: string;
    use_case: string;
    sample_message: string;
    contact_name: string;
    contact_email: string;
}

const BUSINESS_TYPES = [
    'Corporation',
    'Limited Liability Company (LLC)',
    'Partnership',
    'Sole Proprietorship',
    'Non-Profit',
];

const ClientMessagingCompliance: React.FC = () => {
    const { profile } = useAuth();
    const [clientId, setClientId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('not_started');
    const [formData, setFormData] = useState<A2PData>({
        legal_name: '',
        business_type: '',
        ein: '',
        address_street: '',
        address_city: '',
        address_state: '',
        address_zip: '',
        website: '',
        use_case: '',
        sample_message: '',
        contact_name: '',
        contact_email: profile?.email || '',
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!profile) return;
        setIsLoading(true);

        try {
            // 1. Get Client ID
            const { data: clientData } = await supabase
                .from('clients')
                .select('id, business_name, billing_email')
                .eq('owner_profile_id', profile.id)
                .single();

            if (!clientData) throw new Error("Client record not found.");
            setClientId(clientData.id);

            // 2. Get existing data from client_voice_integrations
            const { data: voiceData } = await supabase
                .from('client_voice_integrations')
                .select('a2p_registration_data, a2p_status')
                .eq('client_id', clientData.id)
                .maybeSingle();

            if (voiceData) {
                setStatus(voiceData.a2p_status || 'not_started');
                if (voiceData.a2p_registration_data && Object.keys(voiceData.a2p_registration_data).length > 0) {
                    setFormData(prev => ({
                        ...prev,
                        ...(voiceData.a2p_registration_data as any)
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        legal_name: clientData.business_name,
                        contact_email: clientData.billing_email || prev.contact_email
                    }));
                }
            }
        } catch (e: any) {
            console.error("Error loading compliance data:", e);
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId) return;
        setIsSaving(true);
        setError(null);

        try {
            // Upsert using the newly constrained client_id column
            const { error: upsertError } = await supabase
                .from('client_voice_integrations')
                .upsert({
                    client_id: clientId,
                    a2p_registration_data: formData,
                    a2p_status: 'pending_approval',
                    number_source: 'platform' 
                }, { onConflict: 'client_id' });

            if (upsertError) throw upsertError;

            setSaveSuccess(true);
            setStatus('pending_approval');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e: any) {
            setError(e.message || "Failed to submit information.");
        } finally {
            setIsSaving(true); 
            setTimeout(() => {
                setIsSaving(false);
                setSaveSuccess(false);
            }, 3000);
        }
    };

    const getStatusDisplay = () => {
        switch (status) {
            case 'approved': return { label: 'Verified & Active', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 };
            case 'pending_approval': return { label: 'Under Review', color: 'bg-blue-100 text-blue-800', icon: Clock };
            case 'rejected': return { label: 'Action Required', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
            default: return { label: 'Information Required', color: 'bg-amber-100 text-amber-800', icon: Info };
        }
    };

    const statusDisplay = getStatusDisplay();
    const isLocked = status === 'pending_approval' || status === 'approved';

    if (isLoading) {
        return (
            <ClientLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            </ClientLayout>
        );
    }

    return (
        <ClientLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-indigo-600" /> 
                        Messaging Setup & Security
                    </h1>
                    <p className="text-slate-600 leading-relaxed max-w-2xl">
                        To enable secure text messaging and automated appointment reminders for your business, 
                        we are required by mobile networks to verify your business identity. This ensures your 
                        messages are delivered reliably to your customers.
                    </p>
                </div>

                <div className={`p-4 rounded-xl mb-8 flex items-center justify-between ${statusDisplay.color} border border-current opacity-90`}>
                    <div className="flex items-center gap-3">
                        <statusDisplay.icon className="w-5 h-5" />
                        <div>
                            <p className="font-bold text-sm">Status: {statusDisplay.label}</p>
                            {status === 'pending_approval' && <p className="text-xs mt-0.5">We are currently verifying your business information with the networks.</p>}
                            {status === 'approved' && <p className="text-xs mt-0.5">Your messaging account is fully verified and active.</p>}
                        </div>
                    </div>
                </div>

                {saveSuccess && (
                    <div className="p-4 mb-8 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-fade-in">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <p className="text-sm text-emerald-800 font-bold text-center">Information submitted successfully!</p>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    
                    {isLocked && (
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center gap-3">
                            <Lock className="w-4 h-4 text-slate-400" />
                            <p className="text-xs text-slate-500 font-medium italic">
                                Information is locked while under review or active. Contact support to request updates.
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="p-8 space-y-10">
                        
                        <section>
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-indigo-600" /> 1. Official Business Identity
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Legal Business Name *</label>
                                    <input 
                                        type="text" name="legal_name" value={formData.legal_name} onChange={handleChange} required
                                        placeholder="Exactly as it appears on tax documents"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Business Type *</label>
                                    <select 
                                        name="business_type" value={formData.business_type} onChange={handleChange} required
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    >
                                        <option value="">Select type...</option>
                                        {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Tax ID (EIN) *</label>
                                    <input 
                                        type="text" name="ein" value={formData.ein} onChange={handleChange} required
                                        placeholder="9-digit EIN (XX-XXXXXXX)"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Business Website URL *</label>
                                    <input 
                                        type="url" name="website" value={formData.website} onChange={handleChange} required
                                        placeholder="https://yourbusiness.com"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                            </div>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Globe className="w-5 h-5 text-indigo-600" /> 2. Registered Address
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Street Address *</label>
                                    <input 
                                        type="text" name="address_street" value={formData.address_street} onChange={handleChange} required
                                        placeholder="123 Business Lane"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">City *</label>
                                    <input 
                                        type="text" name="address_city" value={formData.address_city} onChange={handleChange} required
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">State *</label>
                                    <input 
                                        type="text" name="address_state" value={formData.address_state} onChange={handleChange} required
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Zip Code *</label>
                                    <input 
                                        type="text" name="address_zip" value={formData.address_zip} onChange={handleChange} required
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                            </div>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-indigo-600" /> 3. Messaging Intention
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">How will you use messaging? *</label>
                                    <textarea 
                                        name="use_case" value={formData.use_case} onChange={handleChange} required
                                        placeholder="e.g., We use text messages to confirm upcoming appointments and answer general customer questions about our services."
                                        rows={3}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm resize-none disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Provide a sample message *</label>
                                    <textarea 
                                        name="sample_message" value={formData.sample_message} onChange={handleChange} required
                                        placeholder="e.g., Hi [Name], this is Custom Websites Plus. We are confirming your consultation for tomorrow at 2 PM. Reply STOP to opt out."
                                        rows={2}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm resize-none disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                            </div>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-600" /> 4. Primary Contact
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Contact Name *</label>
                                    <input 
                                        type="text" name="contact_name" value={formData.contact_name} onChange={handleChange} required
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Contact Email *</label>
                                    <input 
                                        type="email" name="contact_email" value={formData.contact_email} onChange={handleChange} required
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                        disabled={isLocked}
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="pt-8 border-t border-slate-100">
                            
                            {!isLocked && (
                                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-6 flex items-start gap-3">
                                    <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-indigo-800 font-medium">
                                        Most businesses are approved within 1–3 business days. We’ll handle the setup and notify you as soon as your messaging is ready.
                                    </p>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSaving || isLocked}
                                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                                    isLocked 
                                        ? 'bg-emerald-600 text-white cursor-default' 
                                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl hover:shadow-indigo-200 hover:scale-[1.01]'
                                } disabled:opacity-50`}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Submitting Securely...
                                    </>
                                ) : isLocked ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        Verification in Progress
                                    </>
                                ) : (
                                    <>
                                        Confirm & Submit for Approval
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </ClientLayout>
    );
};

export default ClientMessagingCompliance;