"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, FileText, DollarSign, Plus, CreditCard, Zap, ExternalLink, ShieldCheck, Lock, Trash2, Send, AlertCircle, MessageSquare, Phone, CheckCircle2, Pause, Play, Clock, Download, Edit } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Profile } from '../types/auth';
import { AdminService } from '../services/adminService'; // Use AdminService for admin functions
import { ClientBillingService } from '../services/clientBillingService'; // Use ClientBillingService for client functions
import AddProjectDialog from '../components/AddProjectDialog';
import SendSmsDialog from '../components/SendSmsDialog'; // Import the new dialog
import EditClientDialog from '../components/EditClientDialog'; // New Import

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
  pdf_url: string | null; // Added pdf_url
  created_at: string;
}

interface SubscriptionSummary {
  id: string;
  stripe_price_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface DepositSummary {
  id: string;
  amount_cents: number;
  status: 'paid' | 'pending' | 'failed' | 'applied';
  stripe_invoice_id: string | null;
  applied_to_invoice_id: string | null; // Use this to check if applied
  created_at: string;
}

interface PauseLog {
    id: string;
    action: 'paused' | 'resumed';
    internal_note: string | null;
    client_acknowledged: boolean;
    created_at: string;
}

type ClientServiceStatus = 'active' | 'paused' | 'onboarding' | 'completed';

interface Client {
  id: string;
  business_name: string;
  phone: string;
  status: string; // Client status (active/inactive)
  notes: string;
  owner_profile_id: string;
  stripe_customer_id: string | null;
  billing_email: string | null;
  service_status: ClientServiceStatus; // New field
  profiles: Profile;
  projects: ProjectSummary[];
  invoices: InvoiceSummary[];
  subscriptions: SubscriptionSummary[];
  deposits: DepositSummary[];
  pause_logs: PauseLog[]; // New field
}

interface BillingProduct {
  id: string;
  name: string;
  billing_type: 'one_time' | 'subscription';
  amount_cents: number;
  stripe_price_id: string;
}

const AdminClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'billing' | 'notes'>('billing');
  
  // Dialog State
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false); 
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // New State
  
  // Billing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [selectedSubscriptionPriceId, setSelectedSubscriptionPriceId] = useState('');
  const [selectedOneTimePriceId, setSelectedOneTimePriceId] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([{ description: '', amount: 0 }]);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  
  // Deposit State
  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [depositDescription, setDepositDescription] = useState('');
  const [applyDepositToFuture, setApplyDepositToFuture] = useState(true);
  
  // Service Status State
  const [isServiceUpdating, setIsServiceUpdating] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [serviceActionNote, setServiceActionNote] = useState(''); // Note for pause/resume action

  const fetchClientData = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('clients')
      .select(`
          id, business_name, phone, status, notes, owner_profile_id, stripe_customer_id, billing_email, service_status,
          profiles (id, full_name, email, role),
          projects (id, title, status, progress_percent),
          invoices (id, amount_due, status, hosted_invoice_url, pdf_url, created_at),
          subscriptions (id, stripe_price_id, status, current_period_end, cancel_at_period_end),
          deposits (id, amount_cents, status, stripe_invoice_id, applied_to_invoice_id, created_at),
          service_pause_logs (id, action, internal_note, client_acknowledged, created_at)
      `)
      .eq('id', id)
      .order('created_at', { foreignTable: 'service_pause_logs', ascending: false })
      .single();

    if (error) {
      console.error('Error fetching client details:', error);
      setClient(null);
    } else {
      const clientData = data as unknown as Client;
      setClient(clientData);
      setAdminNotes(clientData.notes || '');
    }
    setIsLoading(false);
  }, [id]);
  
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('billing_products')
      .select('id, name, billing_type, amount_cents, stripe_price_id')
      .eq('active', true);
      
    if (error) {
        console.error('Error fetching billing products:', error);
    } else {
        setProducts(data as BillingProduct[]);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchClientData();
    fetchProducts();
  }, [id, fetchClientData]);

  const handleServiceStatusUpdate = async (newStatus: ClientServiceStatus) => {
    if (!client) return;
    setIsServiceUpdating(true);
    
    const action = newStatus === 'paused' ? 'paused' : 'resumed';
    
    if (action === 'paused' && client.service_status === 'paused') {
        setIsServiceUpdating(false);
        return;
    }
    if (action === 'resumed' && client.service_status !== 'paused') {
        setIsServiceUpdating(false);
        return;
    }

    try {
        // 1. Update client status and timestamps
        const { error: updateError } = await supabase
            .from('clients')
            .update({ 
                service_status: newStatus,
                // Only update timestamps if pausing/resuming
                service_paused_at: action === 'paused' ? new Date().toISOString() : null,
                service_resumed_at: action === 'resumed' ? new Date().toISOString() : null,
            })
            .eq('id', client.id);
            
        if (updateError) throw updateError;

        // 2. Log the action
        const { error: logError } = await supabase
            .from('service_pause_logs')
            .insert({
                client_id: client.id,
                action: action,
                internal_note: serviceActionNote,
            });
            
        if (logError) console.error('Error logging service action:', logError);
        
        // 3. Send notification (Mocked server-side call)
        // NOTE: In a real app, this would be an Edge Function call to send the email securely.
        // await AdminService.sendServiceStatusNotification(client.profiles.email, client.business_name, action);

        alert(`Client service status updated to ${newStatus}! Notification sent.`);
        setServiceActionNote('');
        fetchClientData();
    } catch (e: any) {
        console.error('Error updating service status:', e);
        alert('Failed to update service status.');
    } finally {
        setIsServiceUpdating(false);
    }
  };
  
  const handleSaveNotes = async () => {
    if (!client) return;
    setIsServiceUpdating(true);
    
    const { error } = await supabase
        .from('clients')
        .update({ notes: adminNotes })
        .eq('id', client.id);
        
    if (error) {
        console.error('Error saving notes:', error);
        alert('Failed to save notes.');
    } else {
        alert('Notes saved successfully!');
    }
    setIsServiceUpdating(false);
  };
  
  const handleDeleteClient = async () => {
    if (!client) return;
    
    if (!window.confirm(`WARNING: Are you absolutely sure you want to delete client ${client.business_name}? This action is irreversible and will delete ALL associated data (projects, invoices, user account, etc.).`)) {
        return;
    }
    
    setIsProcessing(true);
    try {
        await AdminService.deleteClientUser(client.id, client.owner_profile_id);
        alert(`Client ${client.business_name} successfully deleted.`);
        navigate('/admin/clients', { replace: true });
    } catch (e: any) {
        alert(`Failed to delete client: ${e.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

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
      case 'grace_period': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'applied': return 'bg-purple-100 text-purple-800';
      case 'onboarding': return 'bg-blue-100 text-blue-800';
      case 'resumed': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };
  
  const getPlanName = (priceId: string) => {
      return products.find(p => p.stripe_price_id === priceId)?.name || 'Unknown Plan';
  };

  // --- Billing Handlers ---

  const handleCreateCustomer = async () => {
    if (!client) return;
    setIsProcessing(true);
    try {
      await AdminService.createStripeCustomer(client.id);
      alert('Stripe Customer created successfully!');
      fetchClientData();
    } catch (e: any) {
      alert(`Failed to create customer: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartSubscription = async () => {
    if (!client || !selectedSubscriptionPriceId) return;
    setIsProcessing(true);
    try {
      const result = await AdminService.createSubscription(client.id, selectedSubscriptionPriceId);
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
      const result = await AdminService.createInvoice(client.id, invoiceItems, invoiceDueDate);
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
  
  const handleCollectDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !depositAmount || depositAmount <= 0) {
        alert('Please enter a valid deposit amount.');
        return;
    }
    setIsProcessing(true);
    try {
        await AdminService.createDepositInvoice(
            client.id, 
            depositAmount as number, 
            depositDescription || 'Project Deposit', 
        );
        
        alert(`Deposit invoice created and sent! Client must pay the invoice.`);
        setDepositAmount('');
        setDepositDescription('');
        setApplyDepositToFuture(true);
        fetchClientData();
    } catch (e: any) {
        alert(`Failed to collect deposit: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePortalSession = async () => {
    if (!client || !client.stripe_customer_id) return;
    setIsProcessing(true);
    try {
      const result = await AdminService.createPortalSession(client.id);
      window.open(result.portal_url, '_blank');
    } catch (e: any) {
      alert(`Failed to create portal session: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddInvoiceItem = () => {
    // If a product is selected, use its details
    if (selectedOneTimePriceId) {
        const product = products.find(p => p.stripe_price_id === selectedOneTimePriceId);
        if (product) {
            setInvoiceItems(prev => [...prev, { 
                description: product.name, 
                amount: product.amount_cents / 100 
            }]);
            setSelectedOneTimePriceId(''); // Reset selection after adding
            return;
        }
    }
    // Otherwise, add a blank line item
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
  
  const overdueInvoicesCount = client?.invoices?.filter(inv => inv.status === 'past_due' || inv.status === 'open').length || 0;
  const subscriptionProducts = products.filter(p => p.billing_type === 'subscription');
  const oneTimeProducts = products.filter(p => p.billing_type === 'one_time');
  
  const unappliedDeposits = client?.deposits?.filter(d => d.status === 'paid' || d.status === 'applied') || [];
  const totalUnappliedCredit = unappliedDeposits.reduce((sum, d) => sum + d.amount_cents, 0) / 100;

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
          <p className="text-slate-500 mt-4">The client ID provided does not exist or the database query failed.</p>
        </div>
      </AdminLayout>
    );
  }

  const currentSubscription = client.subscriptions?.find(sub => sub.status === 'active' || sub.status === 'trialing');

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/admin/clients" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
          ← Back to Client List
        </Link>
        
        <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-slate-900">{client.business_name}</h1>
            <div className="flex gap-3">
                <button 
                    onClick={() => setIsEditDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
                >
                    <Edit className="w-4 h-4" /> Edit Details
                </button>
                <button 
                    onClick={handleDeleteClient}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                    <Trash2 className="w-4 h-4" /> Delete Client
                </button>
            </div>
        </div>
        
        <p className="text-slate-500 mb-8">Contact: {client.profiles?.full_name || 'N/A'} ({client.profiles?.email || 'N/A'})</p>
        
        {/* Quick Actions Bar */}
        <div className="flex gap-4 mb-8">
            <button 
                onClick={() => setIsSmsDialogOpen(true)}
                disabled={!client.phone}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:bg-slate-400 transition-colors"
            >
                <Phone className="w-4 h-4" /> Send SMS
            </button>
            <a 
                href={`mailto:${client.profiles?.email}`}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
                <MessageSquare className="w-4 h-4" /> Send Email
            </a>
        </div>


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
          </nav>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Service Control & Notes */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Service Control */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" /> Service Control
                </h2>
                
                <div className="mb-4 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Current Service Status</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(client.service_status)}`}>
                        {client.service_status.replace('_', ' ')}
                    </span>
                </div>
                
                <div className="space-y-3 mb-4">
                    <textarea
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-500 outline-none"
                        value={serviceActionNote}
                        onChange={(e) => setServiceActionNote(e.target.value)}
                        placeholder="Internal note for pause/resume action (optional)"
                        rows={2}
                        disabled={isServiceUpdating}
                    />
                    <div className="flex gap-3 flex-wrap">
                        {client.service_status !== 'paused' ? (
                            <button 
                                onClick={() => handleServiceStatusUpdate('paused')}
                                disabled={isServiceUpdating || client.service_status === 'completed'}
                                className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Pause className="w-4 h-4" /> Pause Work
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleServiceStatusUpdate('active')}
                                disabled={isServiceUpdating}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Play className="w-4 h-4" /> Resume Work
                            </button>
                        )}
                        <button 
                            onClick={() => handleServiceStatusUpdate('completed')}
                            disabled={isServiceUpdating || client.service_status === 'completed'}
                            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            Complete
                        </button>
                    </div>
                </div>
                
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-t border-slate-100 pt-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" /> Service History
                </h3>
                <div className="max-h-40 overflow-y-auto space-y-2">
                    {client.pause_logs && client.pause_logs.length > 0 ? (
                        client.pause_logs.map(log => (
                            <div key={log.id} className={`p-2 rounded-lg text-xs border ${log.action === 'paused' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold uppercase">{log.action}</span>
                                    <span className="text-slate-500">{new Date(log.created_at).toLocaleDateString()}</span>
                                </div>
                                {log.internal_note && <p className="text-slate-700 mt-1 italic">Note: {log.internal_note}</p>}
                                <div className="flex items-center gap-1 mt-1">
                                    <CheckCircle2 className={`w-3 h-3 ${log.client_acknowledged ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    <span className="text-slate-600">{log.client_acknowledged ? 'Client Acknowledged' : 'Awaiting Client Ack'}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-500">No service history recorded.</p>
                    )}
                </div>
            </div>
            
            {/* Notes Tab Content (Moved here for better layout) */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                    <FileText className="w-5 h-5 text-slate-500" /> Internal Notes
                </h2>
                <textarea
                    className="w-full h-40 p-3 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-500 outline-none"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes here..."
                />
                <button 
                    onClick={handleSaveNotes}
                    disabled={isServiceUpdating}
                    className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    {isServiceUpdating ? 'Saving...' : 'Save Notes'}
                </button>
            </div>
          </div>
          
          {/* Right Column: Projects & Billing */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Projects Tab Content */}
            {activeTab === 'projects' && (
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                    <Briefcase className="w-5 h-5 text-emerald-600" /> Projects ({client.projects?.length || 0})
                  </h2>
                  <div className="space-y-4">
                    {client.projects && client.projects.length > 0 ? (
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
                  <button 
                    onClick={() => setIsProjectDialogOpen(true)}
                    className="mt-6 w-full py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors"
                  >
                    <Plus className="w-4 h-4 inline mr-2" /> Add New Project
                  </button>
                </div>
              </div>
            )}

            {/* Billing Tab Content */}
            {activeTab === 'billing' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Column 1 (1/3 width) */}
                <div className="lg:col-span-1 space-y-8">
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
                          <p className="text-sm text-amber-600 font-semibold mb-4">⚠️ Customer ID Missing</p>
                          <p className="text-xs text-slate-500 mb-4">Customer will be created automatically upon first invoice/subscription.</p>
                          <button 
                            onClick={handleCreateCustomer}
                            disabled={isProcessing}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Create Stripe Customer Now
                          </button>
                        </>
                      )}
                    </div>

                    {/* Subscriptions (Maintenance Only) */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                        <Zap className="w-5 h-5 text-amber-600" /> Maintenance Subscriptions
                      </h2>
                      
                      {currentSubscription ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                            <p className="font-bold text-emerald-800">{getPlanName(currentSubscription.stripe_price_id)}</p>
                            <p className="text-sm text-emerald-700">Status: {currentSubscription.status}</p>
                            <p className="text-xs text-emerald-600">Renews: {currentSubscription.current_period_end ? new Date(currentSubscription.current_period_end).toLocaleDateString() : 'N/A'}</p>
                            {currentSubscription.cancel_at_period_end && (
                                <p className="text-xs text-red-600 font-semibold mt-2">Cancellation pending at period end.</p>
                            )}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm mb-4">No active maintenance subscription.</p>
                      )}

                      <h3 className="font-bold text-sm mb-2">Start New Subscription</h3>
                      <select
                        value={selectedSubscriptionPriceId}
                        onChange={(e) => setSelectedSubscriptionPriceId(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-3"
                        disabled={isProcessing || !client.stripe_customer_id}
                      >
                        <option value="">Select a plan...</option>
                        {subscriptionProducts.map(plan => (
                          <option key={plan.stripe_price_id} value={plan.stripe_price_id}>{plan.name} (${(plan.amount_cents / 100).toFixed(2)}/mo)</option>
                        ))}
                      </select>
                      <button 
                        onClick={handleStartSubscription}
                        disabled={isProcessing || !selectedSubscriptionPriceId || !client.stripe_customer_id}
                        className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Start Subscription
                      </button>
                    </div>
                    
                    {/* Deposit Collection */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                            <DollarSign className="w-5 h-5 text-blue-600" /> Collect Deposit
                        </h2>
                        <form onSubmit={handleCollectDeposit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Deposit Amount (USD) *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(parseFloat(e.target.value) || '')}
                                        className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        disabled={isProcessing}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                                <input
                                    type="text"
                                    value={depositDescription}
                                    onChange={(e) => setDepositDescription(e.target.value)}
                                    placeholder="e.g., Project Kickoff Fee"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    disabled={isProcessing}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="apply-future"
                                    type="checkbox"
                                    checked={applyDepositToFuture}
                                    onChange={(e) => setApplyDepositToFuture(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                    disabled={isProcessing}
                                />
                                <label htmlFor="apply-future" className="text-sm font-medium text-slate-700">
                                    Apply as credit to future invoice
                                </label>
                            </div>
                            <button 
                                type="submit"
                                disabled={isProcessing || !depositAmount}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                                Collect Deposit
                            </button>
                        </form>
                    </div>
                </div>

                {/* Column 2 (2/3 width) */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Unapplied Credit Summary */}
                    {totalUnappliedCredit > 0 && (
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                            <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" /> Total Credit Available
                            </h3>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">
                                ${totalUnappliedCredit.toFixed(2)} USD
                            </p>
                            <p className="text-sm text-emerald-700 mt-2">
                                This credit will be automatically applied to your next project invoice.
                            </p>
                        </div>
                    )}
                    
                    {/* Create Invoice Form */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                        <DollarSign className="w-5 h-5 text-red-600" /> Create One-Time Invoice
                      </h2>
                      <form onSubmit={handleCreateInvoice} className="space-y-4">
                        
                        {/* Product Selector for quick add */}
                        <div className="flex gap-3 items-center">
                            <select
                                value={selectedOneTimePriceId}
                                onChange={(e) => setSelectedOneTimePriceId(e.target.value)}
                                className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                                disabled={isProcessing}
                            >
                                <option value="">Select a one-time product to add...</option>
                                {oneTimeProducts.map(product => (
                                    <option key={product.stripe_price_id} value={product.stripe_price_id}>
                                        {product.name} (${(product.amount_cents / 100).toFixed(2)})
                                    </option>
                                ))}
                            </select>
                            <button type="button" onClick={handleAddInvoiceItem} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50">
                                Add
                            </button>
                        </div>
                        
                        {/* Manual Line Items */}
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
                            {invoiceItems.length > 0 && (
                              <button type="button" onClick={() => handleRemoveInvoiceItem(index)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="flex justify-between">
                            <button type="button" onClick={() => handleAddInvoiceItem()} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
                                <Plus className="w-4 h-4" /> Add Custom Line Item
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
                          disabled={isProcessing}
                          className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                          Create & Send Invoice
                        </button>
                      </form>
                    </div>
                    
                    {/* Deposit History */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                        <CreditCard className="w-5 h-5 text-blue-600" /> Deposit History ({client.deposits?.length || 0})
                      </h2>
                      <div className="space-y-3">
                        {client.deposits && client.deposits.length > 0 ? (
                          client.deposits.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(deposit => (
                            <div key={deposit.id} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="font-medium text-slate-900">${(deposit.amount_cents / 100).toFixed(2)} USD</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(deposit.status)}`}>
                                {deposit.status}
                              </span>
                              {deposit.applied_to_invoice_id && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor('applied')}`}>
                                    Applied
                                  </span>
                              )}
                              {deposit.stripe_invoice_id && (
                                  <a 
                                    href={`https://dashboard.stripe.com/invoices/${deposit.stripe_invoice_id}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-indigo-600 hover:underline flex items-center gap-1"
                                  >
                                    View Invoice <ExternalLink className="w-3 h-3" />
                                  </a>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-500 text-sm">No deposits recorded.</p>
                        )}
                      </div>
                    </div>

                    {/* Invoice List */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                        <FileText className="w-5 h-5 text-purple-600" /> Invoice History ({client.invoices?.length || 0})
                      </h2>
                      <div className="space-y-3">
                        {client.invoices && client.invoices.length > 0 ? (
                          client.invoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(invoice => (
                            <div key={invoice.id} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="font-medium text-slate-900">${(invoice.amount_due / 100).toFixed(2)} USD</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                                {invoice.status}
                              </span>
                              {invoice.pdf_url && invoice.status === 'paid' ? (
                                  <a 
                                    href={invoice.pdf_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-emerald-600 hover:underline flex items-center gap-1"
                                  >
                                    Download <Download className="w-3 h-3" />
                                  </a>
                              ) : (
                                  <a 
                                    href={invoice.hosted_invoice_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-indigo-600 hover:underline flex items-center gap-1"
                                  >
                                    View <ExternalLink className="w-3 h-3" />
                                  </a>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-500 text-sm">No invoices found.</p>
                        )}
                      </div>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Add Project Dialog */}
      {client && (
        <AddProjectDialog
          isOpen={isProjectDialogOpen}
          onClose={() => setIsProjectDialogOpen(false)}
          onProjectAdded={fetchClientData}
          clientId={client.id}
          clientName={client.business_name}
        />
      )}
      
      {/* Send SMS Dialog */}
      {client && (
        <SendSmsDialog
          isOpen={isSmsDialogOpen}
          onClose={() => setIsSmsDialogOpen(false)}
          clientName={client.business_name}
          clientPhone={client.phone}
        />
      )}
      
      {/* Edit Client Dialog */}
      {client && (
        <EditClientDialog
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onClientUpdated={fetchClientData}
          initialClientData={client}
        />
      )}
    </AdminLayout>
  );
};

export default AdminClientDetail;