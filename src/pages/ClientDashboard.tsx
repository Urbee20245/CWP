"use client";

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Briefcase, Loader2, LogOut, CheckCircle2, DollarSign, AlertTriangle, MessageSquare } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import { BillingService } from '../services/billingService';

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
}

interface AccessStatus {
  hasAccess: boolean;
  reason: 'active' | 'overdue' | 'no_subscription' | 'override' | 'restricted' | 'system_error' | 'grace_period';
  graceUntil?: string | null;
}

const ClientDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>({ hasAccess: false, reason: 'restricted' });
  const [showOverdueBanner, setShowOverdueBanner] = useState(true);

  useEffect(() => {
    const fetchClientData = async () => {
      if (!profile) return;
      setIsLoading(true);

      // 1. Find the client record associated with the user's profile ID
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name')
        .eq('owner_profile_id', profile.id)
        .single();

      if (clientError || !clientData) {
        console.error('Error fetching client record:', clientError);
        setIsLoading(false);
        return;
      }
      
      setClientName(clientData.business_name);
      setClientId(clientData.id);
      const currentClientId = clientData.id;

      // 2. Check Access Status via Edge Function
      try {
        const accessResult = await BillingService.checkClientAccess(currentClientId);
        setAccessStatus(accessResult);
        
        // Determine if we should show the non-blocking overdue banner
        if (accessResult.reason === 'grace_period' || (accessResult.hasAccess && accessResult.reason === 'override')) {
            // If access is overridden, we still check for overdue invoices to show a warning
            const { data: overdueInvoices } = await supabase
                .from('invoices')
                .select('id')
                .eq('client_id', currentClientId)
                .in('status', ['open', 'past_due', 'unpaid']);
            
            if (overdueInvoices && overdueInvoices.length > 0) {
                setShowOverdueBanner(true);
            } else {
                setShowOverdueBanner(false);
            }
        } else {
             setShowOverdueBanner(false);
        }

      } catch (e) {
        console.error("Failed to check access:", e);
        setAccessStatus({ hasAccess: false, reason: 'system_error' });
      }

      // 3. Fetch projects only if access is granted (or if we are still loading/checking)
      // We fetch projects regardless of access status here, but the UI will gate display.
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, status, progress_percent')
        .eq('client_id', currentClientId)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
      } else {
        setProjects(projectsData || []);
      }

      setIsLoading(false);
    };

    if (profile) {
      fetchClientData();
    }
  }, [profile]);

  const getProgressColor = (percent: number) => {
    if (percent === 100) return 'bg-emerald-600';
    if (percent >= 75) return 'bg-indigo-600';
    if (percent >= 50) return 'bg-amber-600';
    return 'bg-red-600';
  };
  
  const getAccessMessage = (reason: AccessStatus['reason']) => {
    switch (reason) {
      case 'overdue':
        return "Your account has an overdue invoice. Please resolve billing to regain access to your project dashboard.";
      case 'no_subscription':
        return "An active service plan is required to access your project dashboard. Please contact support or check your billing status.";
      case 'grace_period':
        return "Your invoice is overdue. Access is currently maintained during the grace period, but will be restricted if not resolved.";
      case 'restricted':
      case 'system_error':
      default:
        return "Access is currently restricted. Please contact support for assistance.";
    }
  };

  const renderAccessPanel = () => (
    <div className="max-w-2xl mx-auto p-10 bg-white rounded-xl shadow-2xl border border-red-200 text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
      <h2 className="text-3xl font-bold text-slate-900 mb-4">Access Temporarily Restricted</h2>
      <p className="text-lg text-slate-600 mb-8">{getAccessMessage(accessStatus.reason)}</p>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/client/billing"
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
        >
          <DollarSign className="w-5 h-5" /> View & Pay Invoice
        </Link>
        <a
          href="mailto:hello@customwebsitesplus.com"
          className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-5 h-5" /> Contact Support
        </a>
      </div>
    </div>
  );

  const formatGraceDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome, {profile?.full_name || 'Client'}
          </h1>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Overdue Warning Banner (Non-blocking) */}
        {showOverdueBanner && accessStatus.hasAccess && accessStatus.graceUntil && (
            <div className="p-4 mb-8 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                        <strong>Billing Notice:</strong> Your invoice is overdue. Access will be limited if not resolved by {formatGraceDate(accessStatus.graceUntil || '')}.
                    </p>
                </div>
                <button onClick={() => setShowOverdueBanner(false)} className="text-amber-600 hover:text-amber-800 text-sm font-medium flex-shrink-0">
                    Dismiss
                </button>
            </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 mb-12">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Business: {clientName}</h2>
            <p className="text-sm text-slate-500">Your dedicated client portal for tracking project progress and billing.</p>
        </div>

        {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        ) : accessStatus.hasAccess ? (
            /* Projects List (Visible if access is granted) */
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" /> Your Projects
              </h2>

              {projects.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 rounded-lg">
                    <p className="text-slate-500">No active projects found.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {projects.map((project) => (
                    <Link 
                      key={project.id} 
                      to={`/client/projects/${project.id}`}
                      className="block p-5 border border-slate-200 rounded-xl hover:bg-indigo-50 transition-all hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-bold text-slate-900">{project.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${project.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                          {project.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div 
                            className={`${getProgressColor(project.progress_percent)} h-3 rounded-full transition-all duration-500`} 
                            style={{ width: `${project.progress_percent}%` }}
                          ></div>
                        </div>
                        <span className="text-lg font-bold text-slate-900 w-12 text-right">{project.progress_percent}%</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
        ) : (
            /* Access Restricted Panel (Visible if access is denied) */
            renderAccessPanel()
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;