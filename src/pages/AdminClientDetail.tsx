"use client";

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, FileText, DollarSign, MessageSquare, Phone, Mail, MapPin, Plus, CreditCard, Zap, ExternalLink, ShieldCheck, AlertTriangle, Lock } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Profile } from '../types/auth';
import { BillingService } from '../services/billingService';
import { SUBSCRIPTION_PLANS } from '../config/billing';

interface Client {
  id: string;
  business_name: string;
  phone: string;
  status: string;
  notes: string;
  owner_profile_id: string;
  stripe_customer_id: string | null;
  billing_email: string | null;
  access_override: boolean;
  access_override_note: string | null;
  access_status: string;
  profiles: Profile;
  projects: ProjectSummary[];
  invoices: InvoiceSummary[];
  subscriptions: SubscriptionSummary[];
}

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
}

interface InvoiceSummary {
  id: string;
  amount_due: number;
  status: string;
  hosted_invoice_url: string;
  created_at: string;
}

interface SubscriptionSummary {
  id: string;
  stripe_price_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

const AdminClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'billing' | 'notes' | 'access'>('projects');
  
  // Billing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPriceId, setSelectedPriceId] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([{ description: '', amount: 0 }]);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  
  // Access State
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideNote, setOverrideNote] = useState('');
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  const fetchClientData = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('clients')
      .select(`
          *,
          profiles (id, full_name, email),
          projects (id, title, status, progress_percent),
          invoices (id, amount_due, status, hosted_invoice_url, created_at),
          subscriptions (id, stripe_price_id, status, current_period_end, cancel_at_period_end)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching client details:', error);
      setClient(null);
    } else {
      const clientData = data as unknown as Client;
      setClient(clientData);
      setOverrideEnabled(clientData.access_override);
      setOverrideNote(clientData.access_override_note || '');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchClientData();
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-800';
      case 'paid': return 'bg-emerald-100 text-emerald-800';
      case 'open': return 'bg-amber-100 text-amber-800';
      case 'past_due': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'restricted': return 'bg-red-100 text-red-800';
      case 'override': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // --- Billing Handlers ---

  const handleCreateCustomer = async () => {
    if (!client) return;
    setIsProcessing(true);
    try {
      await BillingService.createStripeCustomer(client.id);
      alert('Stripe Customer created successfully!');
      fetchClientData();
    } catch (e: any) {
      alert(`Failed to create customer: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartSubscription = async () => {
    if (!client || !selectedPriceId) return;
    setIsProcessing(true);
    try {
      const result = await BillingService.createSubscription(client.id, selectedPriceId);
      alert(`Subscription initiated. Status: ${result.status}`);
      
      if (result.requires_action && result.hosted_invoice_url) {
        if (confirm("Subscription requires immediate payment. Redirect to hosted invoice?")) {
            window.open(result.hosted_invoice_url, '_blank');
        }
      }
      fetchClientData();
    } catch (e: any) {
      alert(`Failed to start subscription: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || invoiceItems.length === 0 || invoiceItems.some(item => !item.description || item.amount <= 0)) {
      alert('Please ensure all invoice items have a description and amount.');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await BillingService.createInvoice(client.id, invoiceItems, invoiceDueDate);
      alert(`Invoice created and sent! Status: ${result.status}`);
      setInvoiceItems([{ description: '', amount: 0 }]);
      setInvoiceDueDate('');
      fetchClientData();
    } catch (e: any) {
      alert(`Failed to create invoice: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePortalSession = async () => {
    if (!client || !client.stripe_customer_id) return;
    setIsProcessing(true);
    try {
      const result = await BillingService.createPortalSession(client.id);
      window.open(result.portal_url, '_blank');
    } catch (e: any) {
      alert(`Failed to create portal session: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddInvoiceItem = () => {
    setInvoiceItems([...invoiceItems, { description: '', amount: 0 }]);
  };

  const handleRemoveInvoiceItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const handleInvoiceItemChange = (index: number, field: 'description' | 'amount', value: string | number) => {
    const newItems = [...invoiceItems];
    if (field === 'amount') {
      newItems[index].amount = parseFloat(value as string) || 0;
    } else {
      newItems[index].description = value as string;
    }
    setInvoiceItems(newItems);
  };
  
  // --- Access Handlers ---
  const handleSaveAccessOverride = async () => {
    if (!client) return;
    setIsSavingAccess(true);
    
    const { error } = await supabase
      .from('clients')
      .update({ 
        access_override: overrideEnabled,
        access_override_note: overrideNote.trim() || null,
        // Note: access_status is updated by the server function, but we can set it manually if needed
      })
      .eq('id', client.id);

    if (error) {
      console.error('Error saving access override:', error);
      alert('Failed to save access settings.');
    } else {
      alert('Access settings saved successfully!');
      fetchClientData();
    }
    setIsSavingAccess(false);
  };

  const overdueInvoicesCount = client?.invoices?.filter(inv => inv.status === 'past_due' || inv.status === 'open').length || 0;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </AdminLayout>
    );
  }

  if (!client) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-3xl font-bold text-red-500">Client Not Found</h1>
        </div>
      </AdminLayout>
    );
  }

  const currentSubscription = client.subscriptions?.find(sub => sub.status === 'active' || sub.status === 'trialing');
  const currentPlan = currentSubscription ? SUBSCRIPTION_PLANS.find(p => p.priceId === currentSubscription.stripe_price_id) : null;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/admin/dashboard" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
          ← Back to Clients
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{client.business_name}</h1>
        <p className="text-slate-500 mb-8">Contact: {client.profiles.full_name} ({client.profiles.email})</p>

        {/* Tabs Navigation */}
        <div className="border-b border-slate-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('projects')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'projects'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'billing'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Billing
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'notes'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setActiveTab('access')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'access'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Access Control
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Projects Tab Content */}
          {activeTab === 'projects' && (
            <div className="lg:col-span-3 space-y-8">
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                  <Briefcase className="w-5 h-5 text-emerald-600" /> Projects ({client.projects.length})
                </h2>
                <div className="space-y-4">
                  {client.projects.length > 0 ? (
                    client.projects.map(project => (
                      <Link 
                        key={project.id} 
                        to={`/admin/projects/${project.id}`}
                        className="block p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold text-slate-900">{project.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(project.status)}`}>
                            {project.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div 
                              className="bg-indigo-600 h-2.5 rounded-full" 
                              style={{ width: `${project.progress_percent}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-slate-600 w-10 text-right">{project.progress_percent}%</span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <p className="text-slate-500 text-sm">No projects found for this client.</p>
                  )}
                </div>
                <button className="mt-6 w-full py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
                  <Plus className="w-4 h-4 inline mr-2" /> Add New Project
                </button>
              </div>
            </div>
          )}

          {/* Notes Tab Content */}
          {activeTab === 'notes' && (
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900">
                  <FileText className="w-5 h-5 text-slate-500" /> Internal Notes
                </h2>
                <textarea
                  className="w-full h-40 p-3 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-500 outline-none"
                  defaultValue={client.notes || 'No notes recorded.'}
                  placeholder="Add internal notes here..."
                />
                <button className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                  Save Notes
                </button>
              </div>
            </div>
          )}

          {/* Access Control Tab Content */}
          {activeTab === 'access' && (
            <div className="lg:col-span-3 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                        <Lock className="w-5 h-5 text-indigo-600" /> Access Control
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Current Access Status</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(client.access_status)}`}>
                                {client.access_status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Overdue Invoices</p>
                            <p className="text-xl font-bold text-red-600">{overdueInvoicesCount}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Override Status</p>
                            <p className={`text-xl font-bold ${client.access_override ? 'text-purple-600' : 'text-slate-500'}`}>
                                {client.access_override ? 'ENABLED' : 'DISABLED'}
                            </p>
                        </div>
                    </div>

                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-6">
                        <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5" /> Override Billing Restrictions
                        </h3>
                        <p className="text-sm text-indigo-700 mb-4">
                            Grant client access to the portal regardless of their current subscription or invoice status.
                        </p>
                        
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                            <span className="font-medium text-slate-700">Enable Access Override</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={overrideEnabled} 
                                    onChange={(e) => setOverrideEnabled(e.target.checked)} 
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="override-note" className="block text-sm font-bold text-slate-700 mb-2">
                            Override Note (Admin Only)
                        </label>
                        <textarea
                            id="override-note"
                            rows={3}
                            value={overrideNote}
                            onChange={(e) => setOverrideNote(e.target.value)}
                            placeholder="Reason for override (e.g., 'Good faith extension', 'Internal project')"
                            className="w-full p-3 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <button 
                        onClick={handleSaveAccessOverride}
                        disabled={isSavingAccess}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSavingAccess ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                        Save Access Settings
                    </button>
                </div>
            </div>
          )}

          {/* Billing Tab Content (Existing) */}
          {activeTab === 'billing' && (
            <>
              {/* Left Column: Customer & Subscriptions */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Stripe Customer Status */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900">
                    <CreditCard className="w-5 h-5 text-indigo-600" /> Stripe Customer
                  </h2>
                  {client.stripe_customer_id ? (
                    <>
                      <p className="text-sm text-emerald-600 font-semibold mb-4">✅ Customer ID Linked</p>
                      <p className="text-xs text-slate-500 truncate mb-4">ID: {client.stripe_customer_id}</p>
                      <button 
                        onClick={handlePortalSession}
                        disabled={isProcessing}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" /> Manage Portal
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-red-600 font-semibold mb-4">❌ Customer ID Missing</p>
                      <button 
                        onClick={handleCreateCustomer}
                        disabled={isProcessing}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Create Stripe Customer
                      </button>
                    </>
                  )}
                </div>

                {/* Subscriptions */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                    <Zap className="w-5 h-5 text-amber-600" /> Subscriptions
                  </h2>
                  
                  {currentSubscription ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                        <p className="font-bold text-emerald-800">{currentPlan?.name || 'Unknown Plan'}</p>
                        <p className="text-sm text-emerald-700">Status: {currentSubscription.status}</p>
                        <p className="text-xs text-emerald-600">Renews: {new Date(currentSubscription.current_period_end).toLocaleDateString()}</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm mb-4">No active subscription.</p>
                  )}

                  <h3 className="font-bold text-sm mb-2">Start New Subscription</h3>
                  <select
                    value={selectedPriceId}
                    onChange={(e) => setSelectedPriceId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-3"
                    disabled={isProcessing || !client.stripe_customer_id}
                  >
                    <option value="">Select a plan...</option>
                    {SUBSCRIPTION_PLANS.map(plan => (
                      <option key={plan.priceId} value={plan.priceId}>{plan.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleStartSubscription}
                    disabled={isProcessing || !selectedPriceId || !client.stripe_customer_id}
                    className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Start Subscription
                  </button>
                </div>
              </div>

              {/* Right Column: Invoicing */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Create Invoice Form */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                    <DollarSign className="w-5 h-5 text-red-600" /> Create One-Time Invoice
                  </h2>
                  <form onSubmit={handleCreateInvoice} className="space-y-4">
                    {invoiceItems.map((item, index) => (
                      <div key={index} className="flex gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Item Description"
                          value={item.description}
                          onChange={(e) => handleInvoiceItemChange(index, 'description', e.target.value)}
                          className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                          required
                          disabled={isProcessing}
                        />
                        <div className="relative w-24">
                          <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                          <input
                            type="number"
                            placeholder="Amount"
                            value={item.amount || ''}
                            onChange={(e) => handleInvoiceItemChange(index, 'amount', e.target.value)}
                            className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                            required
                            min="0.01"
                            step="0.01"
                            disabled={isProcessing}
                          />
                        </div>
                        {invoiceItems.length > 1 && (
                          <button type="button" onClick={() => handleRemoveInvoiceItem(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between">
                        <button type="button" onClick={handleAddInvoiceItem} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add Line Item
                        </button>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600">Due Date:</label>
                            <input
                                type="date"
                                value={invoiceDueDate}
                                onChange={(e) => setInvoiceDueDate(e.target.value)}
                                className="p-2 border border-slate-300 rounded-lg text-sm"
                                disabled={isProcessing}
                            />
                        </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={isProcessing || !client.stripe_customer_id}
                      className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                      Create & Send Invoice
                    </button>
                  </form>
                </div>

                {/* Invoice List */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                    <FileText className="w-5 h-5 text-purple-600" /> Invoice History ({client.invoices.length})
                  </h2>
                  <div className="space-y-3">
                    {client.invoices.length > 0 ? (
                      client.invoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(invoice => (
                        <div key={invoice.id} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <span className="font-medium text-slate-900">${(invoice.amount_due / 100).toFixed(2)} USD</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                            {invoice.status}
                          </span>
                          <a 
                            href={invoice.hosted_invoice_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">No invoices found.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminClientDetail;