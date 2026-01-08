"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Loader2, DollarSign, Plus, Zap, Clock, FileText, Trash2, Edit, AlertCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import AiContentGenerator from '../components/AiContentGenerator'; // New Import

interface BillingProduct {
  id: string;
  name: string;
  description: string;
  billing_type: 'one_time' | 'subscription';
  amount_cents: number;
  currency: string;
  stripe_product_id: string;
  stripe_price_id: string;
  active: boolean;
  created_at: string;
}

const AdminBillingProducts: React.FC = () => {
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: 0, // USD
    billingType: 'subscription' as 'one_time' | 'subscription',
  });

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
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
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };
  
  const handleAiContentGenerated = (content: string) => {
    setFormData(prev => ({ ...prev, description: content }));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsCreating(true);

    const { name, description, amount, billingType } = formData;
    const amountCents = Math.round(amount * 100);

    if (!name || amountCents <= 0) {
      setFormError('Name and price must be set.');
      setIsCreating(false);
      return;
    }

    try {
      await AdminService.createBillingProduct({
        name,
        description,
        amount_cents: amountCents,
        billing_type: billingType,
      });

      alert(`Product '${name}' created successfully in Stripe and Supabase!`);
      setFormData({ name: '', description: '', amount: 0, billingType: 'subscription' });
      fetchProducts(); // Refresh list
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
    
    // Note: We only update the Supabase record. Stripe product status is managed separately 
    // but for CWP's internal use, the Supabase 'active' flag controls visibility in the UI.
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

  const getStatusColor = (active: boolean) => active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
  const getTypeIcon = (type: 'one_time' | 'subscription') => type === 'subscription' ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />;

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
              <div>
                <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                    <AiContentGenerator
                        entityType="billing_product"
                        entityName={formData.name || 'New Product'}
                        initialContent={formData.description}
                        onGenerate={handleAiContentGenerated}
                        pricingType={formData.billingType}
                        price={formData.amount}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (USD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount || ''}
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
                  </select>
                </div>
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
                                    <p className="font-bold text-slate-900">${(product.amount_cents / 100).toFixed(2)}</p>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        {getTypeIcon(product.billing_type)}
                                        <span>{product.billing_type === 'subscription' ? 'Monthly' : 'One-Time'}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleToggleActive(product)}
                                    className={`p-1 rounded-full transition-colors ${product.active ? 'text-red-500 hover:bg-red-100' : 'text-emerald-500 hover:bg-emerald-100'}`}
                                >
                                    {product.active ? <Trash2 className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
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