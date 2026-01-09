"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Zap, DollarSign, Plus, Edit, Trash2, CheckCircle2, AlertTriangle, Clock, ExternalLink, Save, X } from 'lucide-react';
import AiContentGenerator from '../components/AiContentGenerator';

interface Addon {
    id: string;
    key: string;
    name: string;
    description: string;
    price_cents: number;
    billing_type: 'one_time' | 'subscription';
    is_active: boolean;
    sort_order: number;
    is_jet_suite_only: boolean;
}

const AdminAddonCatalog: React.FC = () => {
    const [addons, setAddons] = useState<Addon[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editAddon, setEditAddon] = useState<Addon | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    
    const [newAddonData, setNewAddonData] = useState({
        name: '',
        key: '',
        description: '',
        price: 0, // USD
        billingType: 'subscription' as 'one_time' | 'subscription',
        sortOrder: 0,
        isJetSuiteOnly: false,
    });

    const fetchAddons = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('addon_catalog')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching addons:', error);
        } else {
            setAddons(data as Addon[]);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAddons();
    }, [fetchAddons]);

    const handleEditClick = (addon: Addon) => {
        setEditAddon(addon);
        setSaveError(null);
    };
    
    const handleNewFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type, checked } = e.target;
        
        setNewAddonData(prev => {
            let newState = {
                ...prev,
                [name]: type === 'checkbox' ? checked : (name === 'price' || name === 'sortOrder' ? parseFloat(value) : value),
            };
            
            // Auto-generate key from name if the name field is being changed
            if (name === 'name') {
                const generatedKey = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                newState.key = generatedKey;
            }
            
            return newState;
        });
    };
    
    const handleNewAiContentGenerated = (content: string) => {
        setNewAddonData(prev => ({ ...prev, description: content }));
    };

    const handleCreateAddon = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setIsCreating(true);

        const { name, key, description, price, billingType, sortOrder, isJetSuiteOnly } = newAddonData;
        const priceCents = Math.round(price * 100);

        if (!name || !key || priceCents <= 0) {
            setFormError('Name, Key, and Price must be set.');
            setIsCreating(false);
            return;
        }
        
        const payload = {
            name,
            key: key.toLowerCase().replace(/\s/g, '_'),
            description,
            price_cents: priceCents,
            billing_type: billingType,
            is_active: true,
            sort_order: sortOrder,
            is_jet_suite_only: isJetSuiteOnly,
        };

        try {
            const { error } = await supabase
                .from('addon_catalog')
                .insert(payload);

            if (error) throw error;

            alert(`Add-on '${name}' created successfully!`);
            setNewAddonData({ name: '', key: '', description: '', price: 0, billingType: 'subscription', sortOrder: 0, isJetSuiteOnly: false });
            fetchAddons(); // Refresh list
        } catch (e: any) {
            setFormError(e.message || 'Failed to create add-on. Check if the Key is unique.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editAddon) return;

        setIsSaving(true);
        setSaveError(null);
        
        const payload = {
            ...editAddon,
            price_cents: Math.round(editAddon.price_cents),
        };

        try {
            const { error } = await supabase
                .from('addon_catalog')
                .update(payload)
                .eq('id', editAddon.id);

            if (error) throw error;

            alert(`Add-on '${editAddon.name}' updated successfully!`);
            setEditAddon(null);
            fetchAddons();
        } catch (e: any) {
            setSaveError(e.message || 'Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleEditAiContentGenerated = (content: string) => {
        if (editAddon) {
            setEditAddon(prev => prev ? { ...prev, description: content } : null);
        }
    };

    const getStatusColor = (isActive: boolean) => isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
    const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Zap className="w-7 h-7 text-indigo-600" /> AI Add-on Catalog Management
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Create New Add-on */}
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-fit">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Plus className="w-5 h-5 text-indigo-600" /> Create New Add-on
                        </h2>
                        
                        {formError && (
                            <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreateAddon} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={newAddonData.name}
                                    onChange={handleNewFormChange}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isCreating}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Key (Internal ID) *</label>
                                <input
                                    type="text"
                                    name="key"
                                    value={newAddonData.key}
                                    onChange={handleNewFormChange}
                                    placeholder="e.g., missed_call_automation"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-500"
                                    required
                                    readOnly // Make it read-only since it's auto-generated
                                    disabled={isCreating}
                                />
                                <p className="text-xs text-slate-500 mt-1">Automatically generated from Name.</p>
                            </div>
                            <div>
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                                    <AiContentGenerator
                                        entityType="Add-on Service"
                                        entityName={newAddonData.name || 'New Add-on'}
                                        initialContent={newAddonData.description}
                                        onGenerate={handleNewAiContentGenerated}
                                        pricingType={newAddonData.billingType}
                                        price={newAddonData.price}
                                    />
                                </div>
                                <textarea
                                    name="description"
                                    value={newAddonData.description}
                                    onChange={handleNewFormChange}
                                    rows={2}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none"
                                    disabled={isCreating}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Price (USD) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                                        <input
                                            type="number"
                                            name="price"
                                            value={newAddonData.price || ''}
                                            onChange={handleNewFormChange}
                                            className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                            required
                                            min="0.01"
                                            step="0.01"
                                            disabled={isCreating}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Billing Type *</label>
                                    <select
                                        name="billingType"
                                        value={newAddonData.billingType}
                                        onChange={handleNewFormChange}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                        disabled={isCreating}
                                    >
                                        <option value="subscription">Monthly Subscription</option>
                                        <option value="one_time">One-Time Payment</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 pt-2">
                                <label className="flex items-center text-sm font-medium text-slate-700">
                                    <input
                                        type="checkbox"
                                        name="isJetSuiteOnly"
                                        checked={newAddonData.isJetSuiteOnly}
                                        onChange={handleNewFormChange}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mr-2"
                                        disabled={isCreating}
                                    />
                                    Internal Only (JetSuite)
                                </label>
                            </div>
                            
                            <button
                                type="submit"
                                disabled={isCreating || !newAddonData.name || !newAddonData.key || newAddonData.price <= 0}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                {isCreating ? 'Creating...' : 'Create Add-on'}
                            </button>
                        </form>
                    </div>

                    {/* Right Column: Product List */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">
                            Available Add-ons ({addons.length})
                        </h2>

                        {isLoading ? (
                            <div className="flex justify-center items-center h-32">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {addons.map(addon => (
                                    <div key={addon.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center hover:bg-slate-100 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-900 truncate">{addon.name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(addon.is_active)}`}>
                                                    {addon.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                {addon.is_jet_suite_only && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                                        Internal
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">{addon.description}</p>
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900">{formatCurrency(addon.price_cents)}</p>
                                                <p className="text-xs text-slate-500">{addon.billing_type === 'subscription' ? 'Monthly' : 'One-Time'}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleEditClick(addon)}
                                                className="p-1 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Edit Addon Modal */}
            {editAddon && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-xl w-full shadow-2xl animate-scale-in">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <Edit className="w-6 h-6 text-indigo-600" /> Edit {editAddon.name}
                            </h3>
                            <button onClick={() => setEditAddon(null)} className="text-slate-500 hover:text-slate-900">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {saveError && (
                            <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {saveError}
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            
                            {/* Name & Key */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Name *</label>
                                    <input
                                        type="text"
                                        value={editAddon.name}
                                        onChange={(e) => setEditAddon(prev => prev ? { ...prev, name: e.target.value } : null)}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                        disabled={isSaving}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Key (Internal)</label>
                                    <input
                                        type="text"
                                        value={editAddon.key}
                                        readOnly
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-500"
                                    />
                                </div>
                            </div>
                            
                            {/* Price & Billing Type */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Price (USD) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                                        <input
                                            type="number"
                                            value={editAddon.price_cents / 100}
                                            onChange={(e) => setEditAddon(prev => prev ? { ...prev, price_cents: parseFloat(e.target.value) * 100 } : null)}
                                            className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                            required
                                            min="0.01"
                                            step="0.01"
                                            disabled={isSaving}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Billing Type *</label>
                                    <select
                                        value={editAddon.billing_type}
                                        onChange={(e) => setEditAddon(prev => prev ? { ...prev, billing_type: e.target.value as 'one_time' | 'subscription' } : null)}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                        disabled={isSaving}
                                    >
                                        <option value="subscription">Monthly Subscription</option>
                                        <option value="one_time">One-Time Payment</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Sort Order</label>
                                    <input
                                        type="number"
                                        value={editAddon.sort_order}
                                        onChange={(e) => setEditAddon(prev => prev ? { ...prev, sort_order: parseInt(e.target.value) } : null)}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>
                            
                            {/* Description */}
                            <div>
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                                    <AiContentGenerator
                                        entityType="Add-on Service"
                                        entityName={editAddon.name}
                                        initialContent={editAddon.description}
                                        onGenerate={handleEditAiContentGenerated}
                                        pricingType={editAddon.billing_type}
                                        price={editAddon.price_cents / 100}
                                    />
                                </div>
                                <textarea
                                    value={editAddon.description}
                                    onChange={(e) => setEditAddon(prev => prev ? { ...prev, description: e.target.value } : null)}
                                    rows={3}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none"
                                    disabled={isSaving}
                                />
                            </div>
                            
                            {/* Active Toggle */}
                            <div className="flex items-center gap-4 pt-2">
                                <label className="flex items-center text-sm font-medium text-slate-700">
                                    <input
                                        id="is_active"
                                        type="checkbox"
                                        checked={editAddon.is_active}
                                        onChange={(e) => setEditAddon(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
                                        className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 mr-2"
                                        disabled={isSaving}
                                    />
                                    Active (Visible to Clients)
                                </label>
                                <label className="flex items-center text-sm font-medium text-slate-700">
                                    <input
                                        id="is_jet_suite_only"
                                        type="checkbox"
                                        checked={editAddon.is_jet_suite_only}
                                        onChange={(e) => setEditAddon(prev => prev ? { ...prev, is_jet_suite_only: e.target.checked } : null)}
                                        className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500 mr-2"
                                        disabled={isSaving}
                                    />
                                    Internal Only (JetSuite)
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Saving Changes...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminAddonCatalog;