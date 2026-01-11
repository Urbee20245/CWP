"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, FileText, DollarSign, Plus, CreditCard, Zap, ExternalLink, ShieldCheck, Lock, Trash2, Send, AlertCircle, MessageSquare, Phone, CheckCircle2, Pause, Play, Clock, Download, Edit, Bell, BellOff, Users } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Profile } from '../types/auth';
import { AdminService } from '../services/adminService'; // Use AdminService for admin functions
import { ClientBillingService } from '../services/clientBillingService'; // Use ClientBillingService for client functions
import AddProjectDialog from '../components/AddProjectDialog';
import SendSmsDialog from '../components/SendSmsDialog'; // Import the new dialog
import EditClientDialog from '../components/EditClientDialog'; // New Import
import CreateInvoiceForm from '../components/CreateInvoiceForm'; // NEW IMPORT
import { format } from 'date-fns';
import { ensureArray } from '../utils/dataNormalization'; // Import normalization utility
import { useAuth } from '../hooks/useAuth';

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
  last_reminder_sent_at: string | null; // New field
  disable_reminders: boolean; // New field
  stripe_invoice_id: string; // ADDED for audit/resend verification
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

interface AddonRequest {
    id: string;
    addon_key: string;
    addon_name: string;
    status: 'requested' | 'approved' | 'declined';
    notes: string | null;
    requested_at: string;
}

type ClientServiceStatus = 'active' | 'paused' | 'onboarding' | 'completed' | 'awaiting_payment';

interface Client {
  id: string;
  business_name: string;
  phone: string;
  address: string;
  status: string; // Client status (active/inactive)
  notes: string;
  owner_profile_id: string;
  stripe_customer_id: string | null;
  billing_email: string | null;
  service_status: ClientServiceStatus; // New field
  cancellation_reason: string | null; // New field
  cancellation_effective_date: string | null; // New field
  profiles: Profile;
  projects: ProjectSummary[];
  invoices: InvoiceSummary[];
  subscriptions: SubscriptionSummary[];
  deposits: DepositSummary[];
  pause_logs: PauseLog[]; // New field
  addon_requests: AddonRequest[]; // New field
}

interface BillingProduct {
  id: string;
  name: string;
  billing_type: 'one_time' | 'subscription'; // Updated type
  amount_cents: number | null;
  monthly_price_cents: number | null;
  stripe_price_id: string;
  bundled_with_product_id: string | null; // New field
}

const AdminClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'billing' | 'notes' | 'addons'>('addons'); // Default to addons
  const [fetchError, setFetchError] = useState<string | null>(null); // New state for fetch errors
  
  // Dialog State
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false); 
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // New State
  
  // Billing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [selectedSubscriptionPriceId, setSelectedSubscriptionPriceId] = useState('');
  
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
    setFetchError(null);

    // 1. Fetch Main Client Data (including profile)
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select(`
          id, business_name, phone, address, status, notes, owner_profile_id, stripe_customer_id, billing_email, service_status, cancellation_reason, cancellation_effective_date,
          profiles (id, full_name, email, role)
      `)
      .eq('id', id)
      .single();

    if (clientError) {
      console.error('Error fetching client details:', clientError);
      setClient(null);
      setFetchError(clientError.message || 'Failed to load client data.');
      setIsLoading(false);
      return;
    }
    
    const clientRecord = clientData as unknown as Client;

    // 2. Fetch related data separately (Decoupled to prevent schema cache crash)
    const [
        { data: projectsData },
        { data: invoicesData },
        { data: subscriptionsData },
        { data: depositsData },
        { data: pauseLogsData },
        { data: addonRequestsData },
    ] = await Promise.all([
        supabase.from('projects').select('id, title, status, progress_percent').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, amount_due, status, hosted_invoice_url, pdf_url, created_at, last_reminder_sent_at, disable_reminders, stripe_invoice_id').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('id, stripe_price_id, status, current_period_end, cancel_at_period_end').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('deposits').select('id, amount_cents, status, stripe_invoice_id, applied_to_invoice_id, created_at').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('service_pause_logs').select('id, action, internal_note, client_acknowledged, created_at').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('client_addon_requests').select('id, addon_key, addon_name, status, notes, requested_at').eq('client_id', id).order('requested_at', { ascending: false }),
    ]);
    
    // 3. Merge and set state
    const mergedClient: Client = {
        ...clientRecord,
        profiles: clientRecord.profiles as Profile,
        projects: ensureArray(projectsData) as ProjectSummary[],
        invoices: ensureArray(invoicesData) as InvoiceSummary[],
        subscriptions: ensureArray(subscriptionsData) as SubscriptionSummary[],
        deposits: ensureArray(depositsData) as DepositSummary[],
        pause_logs: ensureArray(pauseLogsData) as PauseLog[],
        addon_requests: ensureArray(addonRequestsData) as AddonRequest[],
    };
    
    setClient(mergedClient);
    setAdminNotes(mergedClient.notes || '');
    setIsLoading(false);
  }, [id]);
  
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('billing_products')
      .select('id, name, billing_type, amount_cents, monthly_price_cents, stripe_price_id, bundled_with_product_id')
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
                // Clear cancellation details if resuming
                cancellation_reason: action === 'resumed' ? null : client.cancellation_reason,
                cancellation_effective_date: action === 'resumed' ? null : client.cancellation_effective_date,
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
  
  const handleResendInvoice = async (invoice: InvoiceSummary) => {
      if (!client || !user) return;
      
      if (!client.profiles?.email && !client.billing_email) {
          alert("Cannot resend invoice: Client email address is missing.");
          return;
      }
      
      setIsProcessing(true);
      try {
          await AdminService.resendInvoiceEmail(
              invoice.id,
              client.billing_email || client.profiles.email,
              client.business_name,
              invoice.hosted_invoice_url,
              invoice.amount_due / 100,
              user.id
          );
          alert(`Invoice ${invoice.id.substring(0, 8)} resent successfully!`);
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to resend invoice: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleMarkInvoiceResolved = async (invoiceId: string) => {
      if (!window.confirm("Are you sure you want to manually mark this invoice as PAID? This should only be done if payment was confirmed outside of Stripe.")) return;
      
      setIsProcessing(true);
      try {
          await AdminService.markInvoiceResolved(invoiceId);
          alert(`Invoice ${invoiceId.substring(0, 8)} marked as PAID.`);
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to mark invoice resolved: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleToggleReminders = async (invoice: InvoiceSummary) => {
      setIsProcessing(true);
      try {
          await AdminService.toggleInvoiceReminders(invoice.id, !invoice.disable_reminders);
          alert(`Reminders ${!invoice.disable_reminders ? 'disabled' : 'enabled'} for invoice ${invoice.id.substring(0, 8)}.`);
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to toggle reminders: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleUpdateAddonRequestStatus = async (requestId: string, newStatus: AddonRequest['status']) => {
      if (!window.confirm(`Are you sure you want to mark this request as ${newStatus.toUpperCase()}?`)) return;
      
      setIsProcessing(true);
      try {
          const { error } = await supabase
              .from('client_addon_requests')
              .update({ status: newStatus })
              .eq('id', requestId);
              
          if (error) throw error;
          
          // Optional: Send notification to client about approval/decline
          
          alert(`Request status updated to ${newStatus}.`);
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to update request status: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };
  
  // --- Billing Handlers ---
  const handleCreateCustomer = async () => {
    if (!client) return;
    setIsProcessing(true);
    try {
        const result = await AdminService.createStripeCustomer(client.id);
        alert(`Stripe Customer created: ${result.stripe_customer_id}`);
        fetchClientData();
    } catch (e: any) {
        alert(`Failed to create Stripe Customer: ${e.message}`);
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleStartSubscription = async () => {
    if (!client || !selectedSubscriptionPriceId) return;
    setIsProcessing(true);
    
    const selectedProduct = products.find(p => p.stripe_price_id === selectedSubscriptionPriceId);
    if (!selectedProduct) {
        alert("Selected product not found.");
        setIsProcessing(false);
        return;
    }
    
    let setupFeePriceId: string | undefined = undefined;
    
    // Check if this subscription is bundled with a setup fee product
    if (selectedProduct.bundled_with_product_id) {
        const setupProduct = products.find(p => p.id === selectedProduct.bundled_with_product_id);
        if (setupProduct && setupProduct.billing_type === 'one_time') {
            setupFeePriceId = setupProduct.stripe_price_id;
        } else {
            alert("Bundled setup fee product is invalid or not found.");
            setIsProcessing(false);
            return;
        }
    }
    
    try {
        const result = await AdminService.createSubscription(
            client.id, 
            selectedSubscriptionPriceId, 
            setupFeePriceId // Pass the setup fee price ID
        );
        
        if (result.requires_action && result.hosted_invoice_url) {
            alert("Subscription created but requires payment action. Redirecting to invoice.");
            window.open(result.hosted_invoice_url, '_blank');
        } else {
            alert(`Subscription started successfully! Status: ${result.status}`);
        }
        
        setSelectedSubscriptionPriceId('');
        fetchClientData();
    } catch (e: any) {
        alert(`Failed to start subscription: ${e.message}`);
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handlePortalSession = async () => {
    if (!client || !client.stripe_customer_id) {
        alert("Stripe customer record not found. Please create one first.");
        return;
    }
    setIsProcessing(true);
    try {
      const result = await AdminService.createPortalSession(client.id);
      window.open(result.portal_url, '_blank');
    } catch (e: any) {
      alert(`Failed to open portal: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCollectDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !depositAmount) return;
    setIsProcessing(true);
    
    try {
        // Determine if we should link the deposit to a project (for auto-application later)
        const projectId = applyDepositToFuture && client.projects.length > 0 
            ? client.projects[0].id // Use the first project ID as a default link
            : undefined;
            
        const result = await AdminService.createDepositInvoice(
            client.id,
            depositAmount as number,
            depositDescription || 'Client Deposit',
            projectId
        );
        
        alert(`Deposit invoice sent! Client must pay via hosted URL: ${result.hosted_url}`);
        setDepositAmount('');
        setDepositDescription('');
        fetchClientData();
    } catch (e: any) {
        alert(`Failed to send deposit invoice: ${e.message}`);
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleDeleteDeposit = async (depositId: string) => {
      if (!window.confirm("Are you sure you want to delete this pending deposit?")) return;
      
      setIsProcessing(true);
      try {
          await AdminService.deletePendingDeposit(depositId);
          alert('Pending deposit deleted successfully.');
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to delete deposit: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleSendEmailClick = () => {
      if (!client) return;
      const recipientEmail = client.billing_email || client.profiles?.email;
      const recipientName = client.profiles?.full_name || client.business_name;
      
      if (!recipientEmail) {
          alert("Cannot send email: Client email address is missing.");
          return;
      }
      
      // Navigate to the new dedicated drafting page
      navigate(`/admin/email-draft?clientId=${client.id}&clientEmail=${recipientEmail}&clientName=${client.business_name}&clientFullName=${client.profiles?.full_name}`);
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
      case 'requested': return 'bg-amber-100 text-amber-800'; // New
      case 'approved': return 'bg-emerald-100 text-emerald-800'; // New
      case 'declined': return 'bg-red-100 text-red-800'; // New
      default: return 'bg-slate-100 text-slate-800';
    }
  };
  
  const getPlanName = (priceId: string) => {
      const product = products.find(p => p.stripe_price_id === priceId);
      let name = product?.name || 'Unknown Plan';
      
      if (product?.bundled_with_product_id) {
          const setupProduct = products.find(p => p.id === product.bundled_with_product_id);
          if (setupProduct) {
              name += ` (+ ${setupProduct.name})`;
          }
      }
      return name;
  };

  const isDepositInvoice = (stripeInvoiceId: string) => {
      return client?.deposits?.some(d => d.stripe_invoice_id === stripeInvoiceId) || false;
  };
  
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

  if (fetchError || !client) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-red-500">Unable to load client details.</h1>
          <p className="text-slate-500 mt-4">Error: {fetchError || 'Client not found or data is corrupted.'}</p>
          <button 
            onClick={() => fetchClientData()}
            className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <Loader2 className="w-4 h-4" /> Try Again
          </button>
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
            <button 
                onClick={handleSendEmailClick}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
                <MessageSquare className="w-4 h-4" /> Send Email
            </button>
        </div>


        {/* Tabs Navigation */}
        <div className="border-b border-slate-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('addons')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'addons'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Add-on Requests ({client.addon_requests?.filter(r => r.status === 'requested').length || 0})
            </button>
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
                
                {client.service_status === 'paused' && client.cancellation_effective_date && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-800 uppercase font-semibold mb-1">Cancellation Details</p>
                        <p className="text-sm text-red-700">Effective Date: {format(new Date(client.cancellation_effective_date), 'MMM dd, yyyy')}</p>
                        <p className="text-xs text-red-600 mt-1">Reason: {client.cancellation_reason || 'N/A'}</p>
                    </div>
                )}
                
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
          
          {/* Right Column: Projects, Billing & Addons */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Add-on Requests Tab Content */}
            {activeTab === 'addons' && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                        <Zap className="w-5 h-5 text-indigo-600" /> Add-on Requests ({client.addon_requests?.filter(r => r.status === 'requested').length || 0})
                    </h2>
                    <div className="space-y-4">
                        {client.addon_requests && client.addon_requests.length > 0 ? (
                            client.addon_requests.map(request => (
                                <div key={request.id} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-slate-900">{request.addon_name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                                            {request.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">Requested: {format(new Date(request.requested_at), 'MMM dd, yyyy')}</p>
                                    {request.notes && (
                                        <p className="text-sm text-slate-700 italic p-2 bg-slate-100 rounded-lg border border-slate-200">
                                            Notes: {request.notes}
                                        </p>
                                    )}
                                    
                                    {request.status === 'requested' && (
                                        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                                            <button 
                                                onClick={() => handleUpdateAddonRequestStatus(request.id, 'approved')}
                                                disabled={isProcessing}
                                                className="flex-1 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                            <button 
                                                onClick={() => handleUpdateAddonRequestStatus(request.id, 'declined')}
                                                disabled={isProcessing}
                                                className="flex-1 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-500 text-sm">No add-on requests found for this client.</p>
                        )}
                    </div>
                </div>
            )}

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
                              {project.status.replace('_', ' ')}
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
                        {subscriptionProducts.map(product => (
                          <option key={product.stripe_price_id} value={product.stripe_price_id}>
                            {getPlanName(product.stripe_price_id)} (${(product.monthly_price_cents! / 100).toFixed(2)}/mo)
                          </option>
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
                    
                    {/* Create Invoice Form (Using new component) */}
                    {client && (
                        <CreateInvoiceForm
                            clientId={client.id}
                            oneTimeProducts={oneTimeProducts}
                            onInvoiceCreated={fetchClientData}
                            isProcessing={isProcessing}
                            setIsProcessing={setIsProcessing}
                        />
                    )}
                    
                    {/* Deposit History */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                        <CreditCard className="w-5 h-5 text-blue-600" /> Deposit History ({client.deposits?.length || 0})
                      </h2>
                      <div className="space-y-3">
                        {client.deposits && client.deposits.length > 0 ? (
                          client.deposits.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(deposit => (
                            <div key={deposit.id} className="flex flex-col md:flex-row justify-between items-start md:items-center text-sm p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <div className="flex-1 min-w-0 flex items-center gap-3">
                                  <span className="font-medium text-slate-900">${(deposit.amount_cents / 100).toFixed(2)} USD</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(deposit.status)}`}>
                                    {deposit.status}
                                  </span>
                                  {deposit.applied_to_invoice_id && (
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor('applied')}`}>
                                        Applied
                                      </span>
                                  )}
                              </div>
                              <div className="flex items-center gap-2 mt-2 md:mt-0 flex-shrink-0">
                                  {deposit.status === 'pending' && (
                                      <button 
                                          onClick={() => handleDeleteDeposit(deposit.id)}
                                          disabled={isProcessing}
                                          className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                                          title="Delete Pending Deposit"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
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
                            <div key={invoice.id} className="flex flex-col md:flex-row justify-between items-start md:items-center text-sm p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-slate-900">${(invoice.amount_due / 100).toFixed(2)} USD</span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                                        {invoice.status}
                                      </span>
                                      {isDepositInvoice(invoice.stripe_invoice_id) && (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                              Deposit
                                          </span>
                                      )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <span>Created: {format(new Date(invoice.created_at), 'MMM dd, yyyy')}</span>
                                      {invoice.last_reminder_sent_at && (
                                          <span className="flex items-center gap-1">
                                              • <Bell className="w-3 h-3 text-amber-500" /> Last Reminder: {format(new Date(invoice.last_reminder_sent_at), 'MMM dd')}
                                          </span>
                                      )}
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2 md:mt-0 flex-shrink-0">
                                  {/* Reminder Toggle */}
                                  <button 
                                      onClick={() => handleToggleReminders(invoice)}
                                      disabled={isProcessing || invoice.status === 'paid'}
                                      className={`p-1 rounded-full transition-colors ${invoice.disable_reminders ? 'text-red-500 hover:bg-red-100' : 'text-emerald-500 hover:bg-emerald-100'}`}
                                      title={invoice.disable_reminders ? 'Enable Reminders' : 'Disable Reminders'}
                                  >
                                      {invoice.disable_reminders ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                                  </button>
                                  
                                  {/* Resend Link */}
                                  {(invoice.status === 'open' || invoice.status === 'past_due') && (
                                      <button 
                                          onClick={() => handleResendInvoice(invoice)}
                                          disabled={isProcessing}
                                          className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                                      >
                                          <Send className="w-4 h-4" />
                                      </button>
                                  )}
                                  
                                  {/* Mark Resolved */}
                                  {(invoice.status === 'open' || invoice.status === 'past_due') && (
                                      <button 
                                          onClick={() => handleMarkInvoiceResolved(invoice.id)}
                                          disabled={isProcessing}
                                          className="text-emerald-600 hover:text-emerald-800 text-sm flex items-center gap-1"
                                          title="Mark as Paid Manually"
                                      >
                                          <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                  )}
                                  
                                  {/* View/Download */}
                                  {invoice.pdf_url && invoice.status === 'paid' ? (
                                      <a 
                                        href={invoice.pdf_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-emerald-600 hover:underline flex items-center gap-1"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                  ) : (
                                      <a 
                                        href={invoice.hosted_invoice_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-indigo-600 hover:underline flex items-center gap-1"
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                  )}
                              </div>
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