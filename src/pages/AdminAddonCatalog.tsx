"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Zap, DollarSign, Plus, Edit, Trash2, CheckCircle2, AlertTriangle, Clock, ExternalLink, Save, X } from 'lucide-react';
import AiContentGenerator from '../components/AiContentGenerator';

const PLAN_OPTIONS = [
    { key: 'starter', label: 'Starter ($97/mo)' },
    { key: 'growth',  label: 'Growth ($147/mo)' },
    { key: 'pro',     label: 'Pro ($197/mo)' },
    { key: 'elite',   label: 'Elite ($247/mo)' },
];

interface Addon {
    id: string;
    key: string;
    name: string;
    description: string;
    price_cents: number | null;
    setup_fee_cents: number | null;
    monthly_price_cents: number | null;
    billing_type: 'one_time' | 'subscription' | 'setup_plus_subscription';
    is_active: boolean;
    sort_order: number;
    is_jet_suite_only: boolean;
    addon_type: 'standard' | 'plan_specific';
    eligible_plans: string[];
    included_in_plans: string[];
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
        price: 0,
        setupFee: 0,
        monthlyPrice: 0,
        billingType: 'subscription' as 'one_time' | 'subscription' | 'setup_plus_subscription',
        sortOrder: 0,
        isJetSuiteOnly: false,
        addonType: 'standard' as 'standard' | 'plan_specific',
        eligiblePlans: [] as string[],
        includedInPlans: [] as string[],
    });

    const fetchAddons = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('addon_catalog')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching addons:', error);
            setFormError("Failed to load catalog. Check database connection or RLS policies.");
        } else {
            setAddons(data as Addon[]);
            setFormError(null);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAddons();
    }, [fetchAddons]);

    const handleEditClick = (addon: Addon) => {
        setEditAddon({
            ...addon,
            addon_type: addon.addon_type ?? 'standard',
            eligible_plans: addon.eligible_plans ?? [],
            included_in_plans: addon.included_in_plans ?? [],
        });
        setSaveError(null);
    };
    
    const handleDeleteAddon = async (addon: Addon) => {
        if (!confirm(`Are you sure you want to delete "${addon.name}"?`)) return;
        
        try {
            const { error } = await supabase
                .from('addon_catalog')
                .delete()
                .eq('id', addon.id);
            
            if (error) throw error;
            
            alert(`Add-on "${addon.name}" deleted successfully!`);
            fetchAddons();
        } catch (e: any) {
            alert(`Failed to delete: ${e.message}`);
        }
    };
    
    const handleNewFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setNewAddonData(prev => {
            let newState = {
                ...prev,
                [name]: type === 'checkbox' ? checked : (name === 'price' || name === 'setupFee' || name === 'monthlyPrice' || name === 'sortOrder' ? parseFloat(value || '0') : value),
            };

            if (name === 'name') {
                const generatedKey = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                newState.key = generatedKey;
            }
            // When switching to standard, clear eligible plans
            if (name === 'addonType' && value === 'standard') {
                newState.eligiblePlans = [];
            }

            return newState;
        });
    };

    const handleNewEligiblePlanToggle = (planKey: string) => {
        setNewAddonData(prev => {
            const has = prev.eligiblePlans.includes(planKey);
            return {
                ...prev,
                eligiblePlans: has
                    ? prev.eligiblePlans.filter(p => p !== planKey)
                    : [...prev.eligiblePlans, planKey],
            };
        });
    };

    const handleNewIncludedPlanToggle = (planKey: string) => {
        setNewAddonData(prev => {
            const has = prev.includedInPlans.includes(planKey);
            return {
                ...prev,
                includedInPlans: has
                    ? prev.includedInPlans.filter(p => p !== planKey)
                    : [...prev.includedInPlans, planKey],
            };
        });
    };

    const handleEditEligiblePlanToggle = (planKey: string) => {
        setEditAddon(prev => {
            if (!prev) return null;
            const has = prev.eligible_plans.includes(planKey);
            return {
                ...prev,
                eligible_plans: has
                    ? prev.eligible_plans.filter(p => p !== planKey)
                    : [...prev.eligible_plans, planKey],
            };
        });
    };

    const handleEditIncludedPlanToggle = (planKey: string) => {
        setEditAddon(prev => {
            if (!prev) return null;
            const has = prev.included_in_plans.includes(planKey);
            return {
                ...prev,
                included_in_plans: has
                    ? prev.included_in_plans.filter(p => p !== planKey)
                    : [...prev.included_in_plans, planKey],
            };
        });
    };
    
    const handleNewAiContentGenerated = (content: string) => {
        setNewAddonData(prev => ({ ...prev, description: content }));
    };

    const handleCreateAddon = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setIsCreating(true);

        const { name, key, description, price, setupFee, monthlyPrice, billingType, sortOrder, isJetSuiteOnly, addonType, eligiblePlans, includedInPlans } = newAddonData;
        
        let priceCents = null;
        let setupFeeCents = null;
        let monthlyPriceCents = null;

        if (billingType === 'one_time') {
            priceCents = Math.round(price * 100);
            if (priceCents <= 0) {
                setFormError('One-Time Price must be set.');
                setIsCreating(false);
                return;
            }
        } else if (billingType === 'subscription') {
            monthlyPriceCents = Math.round(monthlyPrice * 100);
            if (monthlyPriceCents <= 0) {
                setFormError('Monthly Price must be set.');
                setIsCreating(false);
                return;
            }
        } else if (billingType === 'setup_plus_subscription') {
            setupFeeCents = Math.round(setupFee * 100);
            monthlyPriceCents = Math.round(monthlyPrice * 100);
            if (setupFeeCents <= 0 || monthlyPriceCents <= 0) {
                setFormError('Setup Fee and Monthly Price must be set.');
                setIsCreating(false);
                return;
            }
        }

        if (!name || !key) {
            setFormError('Name and Key must be set.');
            setIsCreating(false);
            return;
        }
        
        const payload = {
            name,
            key: key.toLowerCase().replace(/\s/g, '_'),
            description,
            price_cents: priceCents,
            setup_fee_cents: setupFeeCents,
            monthly_price_cents: monthlyPriceCents,
            billing_type: billingType,
            is_active: true,
            sort_order: sortOrder,
            is_jet_suite_only: isJetSuiteOnly,
            addon_type: addonType,
            eligible_plans: addonType === 'plan_specific' ? eligiblePlans : [],
            included_in_plans: includedInPlans,
        };

        try {
            const { error } = await supabase
                .from('addon_catalog')
                .insert(payload);

            if (error) throw error;

            alert(`Add-on '${name}' created successfully!`);
            setNewAddonData({ name: '', key: '', description: '', price: 0, setupFee: 0, monthlyPrice: 0, billingType: 'subscription', sortOrder: 0, isJetSuiteOnly: false, addonType: 'standard', eligiblePlans: [], includedInPlans: [] });
            fetchAddons();
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
        
        let priceCents = null;
        let setupFeeCents = null;
        let monthlyPriceCents = null;
        
        if (editAddon.billing_type === 'one_time') {
            priceCents = editAddon.price_cents || 0;
            if (priceCents <= 0) {
                setSaveError('One-Time Price must be greater than 0.');
                setIsSaving(false);
                return;
            }
        } else if (editAddon.billing_type === 'subscription') {
            monthlyPriceCents = editAddon.monthly_price_cents || 0;
            if (monthlyPriceCents <= 0) {
                setSaveError('Monthly Price must be greater than 0.');
                setIsSaving(false);
                return;
            }
        } else if (editAddon.billing_type === 'setup_plus_subscription') {
            setupFeeCents = editAddon.setup_fee_cents || 0;
            monthlyPriceCents = editAddon.monthly_price_cents || 0;
            if (setupFeeCents <= 0 || monthlyPriceCents <= 0) {
                setSaveError('Setup Fee and Monthly Price must be greater than 0.');
                setIsSaving(false);
                return;
            }
        }

        const payload = {
            name: editAddon.name,
            key: editAddon.key,
            description: editAddon.description,
            billing_type: editAddon.billing_type,
            is_active: editAddon.is_active,
            sort_order: editAddon.sort_order,
            is_jet_suite_only: editAddon.is_jet_suite_only,
            price_cents: priceCents,
            setup_fee_cents: setupFeeCents,
            monthly_price_cents: monthlyPriceCents,
            addon_type: editAddon.addon_type,
            eligible_plans: editAddon.addon_type === 'plan_specific' ? editAddon.eligible_plans : [],
            included_in_plans: editAddon.included_in_plans,
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
    const formatCurrency = (cents: number | null) => cents !== null ? `$${(cents / 100).toFixed(2)}` : 'N/A';
    
    const renderPriceDisplay = (addon: Addon) => {
        if (addon.billing_type === 'one_time' && addon.price_cents !== null) {
            return formatCurrency(addon.price_cents);
        }
        if (addon.billing_type === 'subscription' && addon.monthly_price_cents !== null) {
            return `${formatCurrency(addon.monthly_price_cents)}/mo`;
        }
        if (addon.billing_type === 'setup_plus_subscription' && addon.setup_fee_cents !== null && addon.monthly_price_cents !== null) {
            return `${formatCurrency(addon.setup_fee_cents)} + ${formatCurrency(addon.monthly_price_cents)}/mo`;
        }
        return 'N/A';
    };
    
    const renderPriceInputs = (data: typeof newAddonData | Addon, isEdit: boolean = false) => {
        const billingType = isEdit ? (data as Addon).billing_type : (data as typeof newAddonData).billingType;
        
        if (billingType === 'one_time') {
            const price = isEdit ? ((data as Addon).price_cents || 0) / 100 : (data as typeof newAddonData).price;
            return (
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price (USD) *</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                        <input
                            type="number"
                            name="price"
                            value={price || ''}
                            onChange={isEdit ? (e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setEditAddon(prev => prev ? { ...prev, price_cents: Math.round(value * 100), setup_fee_cents: null, monthly_price_cents: null } : null);
                            } : handleNewFormChange}
                            className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                            required
                            min="0.01"
                            step="0.01"
                            disabled={isCreating || isSaving}
                        />
                    </div>
                </div>
            );
        }
        
        if (billingType === 'subscription') {
            const monthlyPrice = isEdit ? ((data as Addon).monthly_price_cents || 0) / 100 : (data as typeof newAddonData).monthlyPrice;
            return (
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Price (USD) *</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                        <input
                            type="number"
                            name="monthlyPrice"
                            value={monthlyPrice || ''}
                            onChange={isEdit ? (e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setEditAddon(prev => prev ? { ...prev, monthly_price_cents: Math.round(value * 100), price_cents: null, setup_fee_cents: null } : null);
                            } : handleNewFormChange}
                            className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                            required
                            min="0.01"
                            step="0.01"
                            disabled={isCreating || isSaving}
                        />
                    </div>
                </div>
            );
        }
        
        if (billingType === 'setup_plus_subscription') {
            const setupFee = isEdit ? ((data as Addon).setup_fee_cents || 0) / 100 : (data as typeof newAddonData).setupFee;
            const monthlyPrice = isEdit ? ((data as Addon).monthly_price_cents || 0) / 100 : (data as typeof newAddonData).monthlyPrice;
            return (
                <>
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Setup Fee (USD) *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                            <input
                                type="number"
                                name="setupFee"
                                value={setupFee || ''}
                                onChange={isEdit ? (e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    setEditAddon(prev => prev ? { ...prev, setup_fee_cents: Math.round(value * 100), price_cents: null } : null);
                                } : handleNewFormChange}
                                className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                required
                                min="0.01"
                                step="0.01"
                                disabled={isCreating || isSaving}
                            />
                        </div>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Price (USD) *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                            <input
                                type="number"
                                name="monthlyPrice"
                                value={monthlyPrice || ''}
                                onChange={isEdit ? (e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    setEditAddon(prev => prev ? { ...prev, monthly_price_cents: Math.round(value * 100) } : null);
                                } : handleNewFormChange}
                                className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                required
                                min="0.01"
                                step="0.01"
                                disabled={isCreating || isSaving}
                            />
                        </div>
                    </div>
                </>
            );
        }
        return null;
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Zap className="w-7 h-7 text-indigo-600" /> AI Add-on Catalog Management
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
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
                                    readOnly
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
                                <div className="col-span-2">
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
                                        <option value="setup_plus_subscription">Setup Fee + Monthly</option>
                                    </select>
                                </div>
                                {renderPriceInputs(newAddonData)}
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

                            {/* Add-on Type */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Add-on Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="addonType"
                                            value="standard"
                                            checked={newAddonData.addonType === 'standard'}
                                            onChange={handleNewFormChange}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                            disabled={isCreating}
                                        />
                                        Standard Add-on
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="addonType"
                                            value="plan_specific"
                                            checked={newAddonData.addonType === 'plan_specific'}
                                            onChange={handleNewFormChange}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                            disabled={isCreating}
                                        />
                                        Plan-Specific
                                    </label>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    {newAddonData.addonType === 'standard'
                                        ? 'Available as an add-on on all plans.'
                                        : 'Restrict this add-on to specific monthly plans.'}
                                </p>
                            </div>

                            {/* Eligible Plans (shown only when plan_specific) */}
                            {newAddonData.addonType === 'plan_specific' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Eligible Plans</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PLAN_OPTIONS.map(plan => (
                                            <label key={plan.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 hover:border-indigo-300 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={newAddonData.eligiblePlans.includes(plan.key)}
                                                    onChange={() => handleNewEligiblePlanToggle(plan.key)}
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    disabled={isCreating}
                                                />
                                                {plan.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Included In Plans */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Included In Plans</label>
                                <p className="text-xs text-slate-400 mb-2">Plans that include this add-on for free (bundled, no extra charge).</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {PLAN_OPTIONS.map(plan => (
                                        <label key={plan.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100 hover:border-emerald-300 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={newAddonData.includedInPlans.includes(plan.key)}
                                                onChange={() => handleNewIncludedPlanToggle(plan.key)}
                                                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                                                disabled={isCreating}
                                            />
                                            {plan.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating || !newAddonData.name || !newAddonData.key || (newAddonData.billingType === 'one_time' && newAddonData.price <= 0) || (newAddonData.billingType === 'subscription' && newAddonData.monthlyPrice <= 0) || (newAddonData.billingType === 'setup_plus_subscription' && (newAddonData.setupFee <= 0 || newAddonData.monthlyPrice <= 0))}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                {isCreating ? 'Creating...' : 'Create Add-on'}
                            </button>
                        </form>
                    </div>

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
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-bold text-slate-900 truncate">{addon.name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(addon.is_active)}`}>
                                                    {addon.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                {addon.is_jet_suite_only && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                                        Internal
                                                    </span>
                                                )}
                                                {addon.addon_type === 'plan_specific' ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                                        Plan-Specific
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                                        Standard
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate mb-1">{addon.description}</p>
                                            {addon.addon_type === 'plan_specific' && addon.eligible_plans?.length > 0 && (
                                                <div className="flex gap-1 flex-wrap mb-1">
                                                    {addon.eligible_plans.map(p => (
                                                        <span key={p} className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {addon.included_in_plans?.length > 0 && (
                                                <div className="flex gap-1 flex-wrap items-center">
                                                    <span className="text-xs text-emerald-600 font-semibold">Bundled:</span>
                                                    {addon.included_in_plans.map(p => (
                                                        <span key={p} className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 capitalize">
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900">{renderPriceDisplay(addon)}</p>
                                                <p className="text-xs text-slate-500">
                                                    {addon.billing_type === 'subscription' ? 'Monthly' : 
                                                     addon.billing_type === 'one_time' ? 'One-Time' : 'Setup + Monthly'}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => handleEditClick(addon)}
                                                className="p-1 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteAddon(addon)}
                                                className="p-1 rounded-full text-red-600 hover:bg-red-100 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {editAddon && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-xl w-full shadow-2xl animate-scale-in">
                        
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
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-3">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Billing Type *</label>
                                    <select
                                        value={editAddon.billing_type}
                                        onChange={(e) => {
                                            const newBillingType = e.target.value as 'one_time' | 'subscription' | 'setup_plus_subscription';
                                            setEditAddon(prev => {
                                                if (!prev) return null;
                                                return {
                                                    ...prev,
                                                    billing_type: newBillingType,
                                                    price_cents: newBillingType === 'one_time' ? (prev.price_cents || 0) : null,
                                                    setup_fee_cents: newBillingType === 'setup_plus_subscription' ? (prev.setup_fee_cents || 0) : null,
                                                    monthly_price_cents: (newBillingType === 'subscription' || newBillingType === 'setup_plus_subscription') ? (prev.monthly_price_cents || 0) : null,
                                                };
                                            });
                                        }}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                        disabled={isSaving}
                                    >
                                        <option value="subscription">Monthly Subscription</option>
                                        <option value="one_time">One-Time Payment</option>
                                        <option value="setup_plus_subscription">Setup Fee + Monthly</option>
                                    </select>
                                </div>
                                {renderPriceInputs(editAddon, true)}
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                                    <AiContentGenerator
                                        entityType="Add-on Service"
                                        entityName={editAddon.name}
                                        initialContent={editAddon.description}
                                        onGenerate={handleEditAiContentGenerated}
                                        pricingType={editAddon.billing_type}
                                        price={editAddon.price_cents ? editAddon.price_cents / 100 : 0}
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

                            {/* Add-on Type */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Add-on Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="edit_addonType"
                                            value="standard"
                                            checked={editAddon.addon_type === 'standard'}
                                            onChange={() => setEditAddon(prev => prev ? { ...prev, addon_type: 'standard', eligible_plans: [] } : null)}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                            disabled={isSaving}
                                        />
                                        Standard Add-on
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="edit_addonType"
                                            value="plan_specific"
                                            checked={editAddon.addon_type === 'plan_specific'}
                                            onChange={() => setEditAddon(prev => prev ? { ...prev, addon_type: 'plan_specific' } : null)}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                            disabled={isSaving}
                                        />
                                        Plan-Specific
                                    </label>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    {editAddon.addon_type === 'standard'
                                        ? 'Available as an add-on on all plans.'
                                        : 'Restrict this add-on to specific monthly plans.'}
                                </p>
                            </div>

                            {/* Eligible Plans */}
                            {editAddon.addon_type === 'plan_specific' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Eligible Plans</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PLAN_OPTIONS.map(plan => (
                                            <label key={plan.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 hover:border-indigo-300 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={editAddon.eligible_plans.includes(plan.key)}
                                                    onChange={() => handleEditEligiblePlanToggle(plan.key)}
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    disabled={isSaving}
                                                />
                                                {plan.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Included In Plans */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Included In Plans</label>
                                <p className="text-xs text-slate-400 mb-2">Plans that include this add-on for free (bundled, no extra charge).</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {PLAN_OPTIONS.map(plan => (
                                        <label key={plan.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100 hover:border-emerald-300 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={editAddon.included_in_plans.includes(plan.key)}
                                                onChange={() => handleEditIncludedPlanToggle(plan.key)}
                                                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                                                disabled={isSaving}
                                            />
                                            {plan.label}
                                        </label>
                                    ))}
                                </div>
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
