"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Zap, DollarSign, CheckCircle2, AlertTriangle, MessageSquare, Plus, X, Clock } from 'lucide-react';
import { ClientBillingService } from '../services/clientBillingService';

interface Addon {
    id: string;
    key: string;
    name: string;
    description: string;
    price_cents: number;
    billing_type: 'one_time' | 'subscription';
    is_active: boolean;
}

interface Request {
    id: string;
    addon_key: string;
    status: 'requested' | 'approved' | 'declined';
    notes: string | null;
    requested_at: string;
}

const ClientAddons: React.FC = () => {
    const { profile } = useAuth();
    const [addons, setAddons] = useState<Addon[]>([]);
    const [requests, setRequests] = useState<Request[]>([]);
    const [clientId, setClientId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [requestNotes, setRequestNotes] = useState('');
    const [selectedAddonKey, setSelectedAddonKey] = useState<string | null>(null);

    const fetchAddonData = useCallback(async () => {
        if (!profile) return;

        // 1. Get Client ID
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('owner_profile_id', profile.id)
            .single();

        if (clientError || !clientData) {
            console.error('Client record not found:', clientError);
            setIsLoading(false);
            return;
        }
        const currentClientId = clientData.id;
        setClientId(currentClientId);

        // 2. Fetch active Add-on Catalog
        const { data: addonData, error: addonError } = await supabase
            .from('addon_catalog')
            .select('*')
            .eq('is_active', true)
            .eq('is_jet_suite_only', false) // Only show non-JetSuite specific addons
            .order('sort_order', { ascending: true });

        if (addonError) {
            console.error('Error fetching addons:', addonError);
        } else {
            setAddons(addonData as Addon[]);
        }
        
        // 3. Fetch existing requests
        const { data: requestData, error: requestError } = await supabase
            .from('client_addon_requests')
            .select('id, addon_key, status, notes, requested_at')
            .eq('client_id', currentClientId)
            .order('requested_at', { ascending: false });
            
        if (requestError) {
            console.error('Error fetching requests:', requestError);
        } else {
            setRequests(requestData as Request[]);
        }

        setIsLoading(false);
    }, [profile]);

    useEffect(() => {
        fetchAddonData();
    }, [fetchAddonData]);
    
    const handleRequestAddon = async (addon: Addon) => {
        if (!clientId) {
            setSubmitError('Client ID not found. Please contact support.');
            return;
        }
        
        setIsSubmitting(true);
        setSubmitError(null);
        
        try {
            await ClientBillingService.requestAddon(
                clientId,
                addon.key,
                addon.name,
                requestNotes
            );
            
            alert(`Request for ${addon.name} sent successfully!`);
            setRequestNotes('');
            setSelectedAddonKey(null);
            fetchAddonData(); // Refresh list and requests
            
        } catch (e: any) {
            setSubmitError(e.message || 'Failed to submit request.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const getRequestStatus = (addonKey: string) => {
        const request = requests.find(r => r.addon_key === addonKey && r.status === 'requested');
        if (request) return 'requested';
        const approved = requests.find(r => r.addon_key === addonKey && r.status === 'approved');
        if (approved) return 'approved';
        return 'none';
    };
    
    const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    if (isLoading) {
        return (
            <ClientLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
            </ClientLayout>
        );
    }

    return (
        <ClientLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Zap className="w-7 h-7 text-indigo-600" /> AI & Customer Engagement Add-ons
                </h1>
                
                <div className="p-4 mb-8 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-indigo-800 mb-1">Request Only</p>
                        <p className="text-sm text-indigo-700">
                            These add-ons require custom setup and configuration. Request the service you want, and our team will contact you to finalize the details and billing.
                        </p>
                    </div>
                </div>

                {submitError && (
                    <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {submitError}
                    </div>
                )}

                {addons.length === 0 ? (
                    <div className="p-12 bg-white rounded-xl shadow-lg border border-slate-200 text-center">
                        <Zap className="w-10 h-10 text-slate-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">No Add-ons Currently Available</h2>
                        <p className="text-slate-600">
                            No add-ons are currently available. Contact support for custom services.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {addons.map((addon) => {
                            const status = getRequestStatus(addon.key);
                            const isRequested = status === 'requested';
                            const isApproved = status === 'approved';
                            
                            return (
                                <div 
                                    key={addon.id} 
                                    className={`bg-white p-6 rounded-xl shadow-lg border ${isApproved ? 'border-emerald-300' : 'border-slate-100'} flex flex-col`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-bold text-slate-900">{addon.name}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${addon.billing_type === 'subscription' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {addon.billing_type === 'subscription' ? 'Monthly' : 'One-Time'}
                                        </span>
                                    </div>
                                    
                                    <p className="text-3xl font-bold text-slate-900 mb-4">
                                        {formatCurrency(addon.price_cents)}
                                        <span className="text-base font-medium text-slate-500">/mo</span>
                                    </p>
                                    
                                    <p className="text-sm text-slate-600 mb-6 flex-grow">{addon.description}</p>
                                    
                                    {isApproved ? (
                                        <button 
                                            disabled
                                            className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Service Approved
                                        </button>
                                    ) : isRequested ? (
                                        <button 
                                            disabled
                                            className="w-full py-3 bg-amber-500 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                                        >
                                            <Clock className="w-4 h-4" /> Request Pending
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => setSelectedAddonKey(addon.key)}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Request Add-on
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {/* Request Modal/Form */}
                {selectedAddonKey && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                                <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                    <Zap className="w-6 h-6 text-indigo-600" /> Confirm Request
                                </h3>
                                <button onClick={() => setSelectedAddonKey(null)} className="text-slate-500 hover:text-slate-900">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <p className="text-lg font-semibold text-slate-700 mb-4">
                                Requesting: {addons.find(a => a.key === selectedAddonKey)?.name}
                            </p>
                            
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const addon = addons.find(a => a.key === selectedAddonKey);
                                if (addon) handleRequestAddon(addon);
                            }} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Notes for the Admin Team (Optional)
                                    </label>
                                    <textarea
                                        value={requestNotes}
                                        onChange={(e) => setRequestNotes(e.target.value)}
                                        placeholder="e.g., We need this integrated by the end of the month."
                                        rows={3}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none focus:border-indigo-500 outline-none"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Submitting Request...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-5 h-5" />
                                            Confirm Request
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </ClientLayout>
    );
};

export default ClientAddons;