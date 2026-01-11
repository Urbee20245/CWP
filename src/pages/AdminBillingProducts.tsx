"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Loader2, DollarSign, Plus, Zap, Clock, FileText, Trash2, Edit, AlertCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import AiContentGenerator from '../components/AiContentGenerator'; // New Import
import { useNavigate } from 'react-router-dom';

interface BillingProduct {
  id: string;
  name: string;
  description: string;
  billing_type: 'one_time' | 'subscription' | 'setup_plus_subscription'; // Updated type
  amount_cents: number | null; // Can be null if setup+subscription
  setup_fee_cents: number | null; // New field
  monthly_price_cents: number | null; // New field for subscription part
  currency: string;
  stripe_product_id: string;
  stripe_price_id: string;
  active: boolean;
  created_at: string;
}

interface Client {
    id: string;
    business_name: string;
}

const PRODUCT_FEATURES = [
    'Complete Website Rebuild',
    'Website Application',
    'Custom CRM Build',
    'SEO Optimization',
    'AI Chatbot Integration',
    'Mobile Optimization',
    'E-commerce Setup',
    'Ongoing Maintenance'
];

const AdminBillingProducts: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    oneTimeAmount: 0, // USD for one_time
    setupFee: 0, // USD for setup_plus_subscription
    monthlyPrice: 0, // USD for subscription/setup_plus_subscription
    billingType: 'one_time' as 'one_time' | 'subscription' | 'setup_plus_subscription',
    features: [] as string[],
  });

  const fetchProducts = useCallback(async () => {
    // Fetch all products, including inactive ones, for admin view
    const { data, error } = await supabase
      .from('billing_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching billing products:', error);
    } else {
      setProducts(data as BillingProduct[]);
    }
  }, []);
  
  const fetchClients = useCallback(async () => {
    const { data, error } = await supabase
        .from('clients')
        .select('id, business_name')
        .order('business_name', { ascending: true });
    
    if (error) {
        console.error('Error fetching clients:', error);
    } else {
        setClients(data as Client[]);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchClients();
    // Set loading to false after initial fetches
    setIsLoading(false);
  }, [fetchProducts, fetchClients]);

  // Effect to update description when features change
  useEffect(() => {
    const featureList = formData.features.length > 0 
        ? `Key Features: ${formData.features.join(', ')}. ` 
        : '';
    
    if (formData.description.startsWith('Key Features:') || formData.description === '' || featureList === '') {
        setFormData(prev => ({
            ...prev,
            description: featureList + prev.description.replace(/^Key Features:.*?\.\s*/, ''),
        }));
    }
  }, [formData.features]);


  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };
  
  const handleFeatureChange = (feature: string, isChecked: boolean) => {
    setFormData(prev => {
        const newFeatures = isChecked
            ? [...prev.features, feature]
            : prev.features.filter(f => f !== feature);
        return { ...prev, features: newFeatures };
    });
  };
  
  const handleAiContentGenerated = (content: string) => {
    setFormData(prev => ({ ...prev, description: content }));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsCreating(true);

    const { name, description, oneTimeAmount, setupFee, monthlyPrice, billingType } = formData;
    
    let amountCents = null;
    let setupFeeCents = null;
    let monthlyPriceCents = null;

    if (billingType === 'one_time') {
        amountCents = Math.round(oneTimeAmount * 100);
        if (amountCents <= 0) {
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

    if (!name) {
        setFormError('Product Name must be set.');
        setIsCreating(false);
        return;
    }
    
    const finalDescription = description;

    try {
      // CRITICAL FIX: Only send amount_cents if billing_type is 'one_time'
      const finalAmountCents = billingType === 'one_time' ? amountCents : null;
      
      await AdminService.createBillingProduct({
        name,
        description: finalDescription,
        amount_cents: finalAmountCents, // Corrected: null for subscription types
        billing_type: billingType,
        setup_fee_cents: setupFeeCents,
        monthly_price_cents: monthlyPriceCents,
      });

      alert(`Product '${name}' created successfully in Stripe and Supabase!`);
      setFormData({ name: '', description: '', oneTimeAmount: 0, setupFee: 0, monthlyPrice: 0, billingType: 'subscription', features: [] });
      fetchProducts(); // Refresh list
      
      if (selectedClient) {
          const clientName = clients.find(c => c.id === selectedClient)?.business_name;
          alert(`Product created. Redirecting to ${clientName}'s billing page to use the new product.`);
          navigate(`/admin/clients/${selectedClient}?tab=billing`);
      }
      
    } catch (e: any) {
      setFormError(e.message || 'Failed to create product.');
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleToggleActive = async (product: BillingProduct) => {
    const newActiveStatus = !product.active;
    const confirmMessage = newActiveStatus 
        ? `Are you sure you want to reactivate '${product.name}'? It will be available for new sales.`
        : `Are you sure you want to archive '${product.name}'? It will NOT affect existing subscriptions but cannot be used for new sales.`;
        
    if (!window.confirm(confirmMessage)) return;
    
    const { error } = await supabase
        .from('billing_products')
        .update({ active: newActiveStatus })
        .eq('id', product.id);
        
    if (error) {
        console.error('Error updating product status:', error);
        alert('Failed to update product status.');
    } else {
        fetchProducts();
    }
  };
  
  const handleDeleteProduct = async (product: BillingProduct) => {
      if (!window.confirm(`WARNING: Are you sure you want to permanently delete '${product.name}'? This cannot be undone and may break existing records if this product is in use.`)) return;
      
      setIsDeleting(true);
      try {
          // 1. Delete from Supabase
          const { error: dbError } = await supabase
              .from('billing_products')
              .delete()
              .eq('id', product.id);
              
          if (dbError) throw dbError;
          
          // 2. Optionally delete from Stripe (requires more complex logic to ensure no active subscriptions exist, skipping for MVP safety)
          
          alert(`Product '${product.name}' deleted successfully!`);
          fetchProducts();
      } catch (e: any) {
          alert(`Failed to delete product: ${e.message}`);
      } finally {
          setIsDeleting(false);
      }
  };

  const getStatusColor = (active: boolean) => active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
  const getTypeIcon = (type: BillingProduct['billing_type']) => {
      switch (type) {
          case 'subscription': return <Zap className="w-4 h-4" />;
          case 'one_time': return <Clock className="w-4 h-4" />;
          case 'setup_plus_subscription': return <DollarSign className="w-4 h-4" />;
          default: return <FileText className="w-4 h-4" />;
      }
  };
  
  const renderPriceDisplay = (product: BillingProduct) => {
      if (product.billing_type === 'one_time' && product.amount_cents !== null) {
          return `$${(product.amount_cents / 100).toFixed(2)}`;
      }
      if (product.billing_type === 'subscription' && product.monthly_price_cents !== null) {
          return `$${(product.monthly_price_cents / 100).toFixed(2)}/mo`;
      }
      if (product.billing_type === 'setup_plus_subscription' && product.setup_fee_cents !== null && product.monthly_price_cents !== null) {
          return `Setup: $${(product.setup_fee_cents / 100).toFixed(2)} + $${(product.monthly_price_cents / 100).toFixed(2)}/mo`;
      }
      return 'N/A';
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-indigo-600" /> Billing Product Management
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Create Product Form */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-fit">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Plus className="w-5 h-5 text-indigo-600" /> Create New Product
            </h2>
            
            {formError && (
                <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {formError}
                </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  required
                  disabled={isCreating}
                />
              </div>
              
              {/* Product Features Checkboxes */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Product Features (Optional)</label>
                <div className="grid grid-cols-2 gap-2">
                    {PRODUCT_FEATURES.map(feature => (
                        <label key={feature} className="flex items-center text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={formData.features.includes(feature)}
                                onChange={(e) => handleFeatureChange(feature, e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mr-2"
                                disabled={isCreating}
                            />
                            {feature}
                        </label>
                    ))}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                    <AiContentGenerator
                        entityType="billing_product"
                        entityName={formData.name || 'New Product'}
                        initialContent={formData.description}
                        onGenerate={handleAiContentGenerated}
                        pricingType={formData.billingType}
                        price={formData.oneTimeAmount || formData.monthlyPrice}
                        keyFeatures={formData.features.join(', ')}
                    />
                </div>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none"
                  disabled={isCreating}
                />
              </div>
              
              {/* Billing Type Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Billing Type *</label>
                <select
                  name="billingType"
                  value={formData.billingType}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  required
                  disabled={isCreating}
                >
                  <option value="subscription">Monthly Subscription</option>
                  <option value="one_time">One-Time Payment</option>
                  <option value="setup_plus_subscription">Setup Fee + Monthly Subscription</option>
                </select>
              </div>
              
              {/* Conditional Price Inputs */}
              <div className="grid grid-cols-2 gap-4">
                {formData.billingType === 'one_time' && (
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Price (USD) *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                            <input
                                type="number"
                                name="oneTimeAmount"
                                value={formData.oneTimeAmount || ''}
                                onChange={handleFormChange}
                                className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                required
                                min="0.01"
                                step="0.01"
                                disabled={isCreating}
                            />
                        </div>
                    </div>
                )}
                
                {formData.billingType === 'subscription' && (
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Price (USD) *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                            <input
                                type="number"
                                name="monthlyPrice"
                                value={formData.monthlyPrice || ''}
                                onChange={handleFormChange}
                                className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                required
                                min="0.01"
                                step="0.01"
                                disabled={isCreating}
                            />
                        </div>
                    </div>
                )}
                
                {formData.billingType === 'setup_plus_subscription' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Setup Fee (USD) *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                                <input
                                    type="number"
                                    name="setupFee"
                                    value={formData.setupFee || ''}
                                    onChange={handleFormChange}
                                    className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    disabled={isCreating}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Price (USD) *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                                <input
                                    type="number"
                                    name="monthlyPrice"
                                    value={formData.monthlyPrice || ''}
                                    onChange={handleFormChange}
                                    className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    disabled={isCreating}
                                />
                            </div>
                        </div>
                    </>
                )}
              </div>
              
              {/* Client Selector */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Action Client (Optional)</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  disabled={isCreating}
                >
                  <option value="">-- Select Client to Initiate Action --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.business_name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Selecting a client redirects you to their billing page after creation.</p>
              </div>
              
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {isCreating ? 'Creating...' : 'Create Product'}
              </button>
            </form>
          </div>

          {/* Right Column: Product List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
              <FileText className="w-5 h-5 text-purple-600" /> Existing Products ({products.length})
            </h2>
            
            {isLoading ? (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="space-y-4">
                    {products.map(product => (
                        <div key={product.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center hover:bg-slate-100 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-900 truncate">{product.name}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(product.active)}`}>
                                        {product.active ? 'Active' : 'Archived'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{product.description}</p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">{renderPriceDisplay(product)}</p>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        {getTypeIcon(product.billing_type)}
                                        <span>{product.billing_type.replace('_', ' ')}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleToggleActive(product)}
                                    disabled={isDeleting}
                                    className={`p-1 rounded-full transition-colors ${product.active ? 'text-red-500 hover:bg-red-100' : 'text-emerald-500 hover:bg-emerald-100'}`}
                                    title={product.active ? 'Archive Product' : 'Activate Product'}
                                >
                                    {product.active ? <Trash2 className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                                </button>
                                <button 
                                    onClick={() => handleDeleteProduct(product)}
                                    disabled={isDeleting}
                                    className="p-1 rounded-full text-red-500 hover:bg-red-100 transition-colors"
                                    title="Permanently Delete Product"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminBillingProducts;