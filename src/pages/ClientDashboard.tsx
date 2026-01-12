"use client";

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Briefcase, Loader2, LogOut, AlertTriangle, Users, HelpCircle } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import ServiceStatusBanner from '../components/ServiceStatusBanner';

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
  required_deposit_cents: number | null;
  deposit_paid: boolean;
}

const ClientDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [clientServiceStatus, setClientServiceStatus] = useState<'active' | 'paused' | 'onboarding' | 'completed'>('onboarding');
  const [showOverdueBanner, setShowOverdueBanner] = useState(false);
  const [isClientRecordMissing, setIsClientRecordMissing] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false); // New state for help popover

  useEffect(() => {
    const fetchClientData = async () => {
      if (!profile) return;
      setIsLoading(true);

      // 1. Find the client record associated with the user's profile ID
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name, service_status')
        .eq('owner_profile_id', profile.id)
        .single();

      if (clientError && clientError.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error('Error fetching client record:', clientError);
        setIsClientRecordMissing(true);
        setIsLoading(false);
        return;
      }
      
      if (!clientData) {
        setIsClientRecordMissing(true);
        setIsLoading(false);
        return;
      }
      
      setClientName(clientData.business_name);
      setClientServiceStatus(clientData.service_status as any);
      const currentClientId = clientData.id;
      setIsClientRecordMissing(false);

      // 2. Check for Overdue Invoices (for non-blocking banner only)
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

      // 3. Fetch projects (always accessible)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, status, progress_percent, required_deposit_cents, deposit_paid')
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
  
  const renderMissingClientPanel = () => (
    <div className="max-w-2xl mx-auto p-10 bg-white rounded-xl shadow-2xl border border-red-200 text-center">
      <Users className="w-16 h-16 text-red-500 mx-auto mb-6" />
      <h2 className="text-3xl font-bold text-slate-900 mb-4">Client Record Not Found</h2>
      <p className="text-lg text-slate-600 mb-8">
        Your user account is not currently linked to a client business record. 
        If you believe this is an error, please contact your administrator.
      </p>
      <button onClick={signOut} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 mx-auto">
        <LogOut className="w-5 h-5" /> Sign Out
      </button>
    </div>
  );

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3 relative">
            Welcome, {profile?.full_name || 'Client'}
            <button 
                onClick={() => setIsHelpOpen(!isHelpOpen)}
                className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                aria-label="Help"
            >
                <HelpCircle className="w-5 h-5" />
            </button>
            {isHelpOpen && (
                <div className="absolute z-10 top-full left-0 mt-2 w-80 p-4 bg-white rounded-lg shadow-xl border border-slate-200 text-sm text-slate-700">
                    <p className="font-bold mb-1">Client Dashboard Overview</p>
                    <p>This is your central hub. Track the status of your projects, view overdue invoices, and access key client information.</p>
                </div>
            )}
          </h1>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        ) : isClientRecordMissing ? (
            renderMissingClientPanel()
        ) : (
            <>
                {/* Service Status Banner (Non-blocking) */}
                <ServiceStatusBanner status={clientServiceStatus} type="client" />

                {/* Overdue Warning Banner (Non-blocking) */}
                {showOverdueBanner && (
                    <div className="p-4 mb-8 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                            <p className="text-sm text-amber-800">
                                <strong>Billing Notice:</strong> You have one or more overdue invoices. Please visit the billing section to resolve.
                            </p>
                        </div>
                        <Link to="/client/billing" className="text-amber-600 hover:text-amber-800 text-sm font-medium flex-shrink-0">
                            View Billing
                        </Link>
                    </div>
                )}
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 mb-12">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Business: {clientName}</h2>
                    <p className="text-sm text-slate-500">Your dedicated client portal for tracking project progress and billing.</p>
                </div>

                {/* Projects List (Always visible if client record exists) */}
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
                            <div className="flex items-center gap-2">
                                {project.required_deposit_cents && project.required_deposit_cents > 0 && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${project.deposit_paid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                        {project.deposit_paid ? 'Deposit Paid' : 'Deposit Due'}
                                    </span>
                                )}
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${project.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                    {project.status.replace('_', ' ')}
                                </span>
                            </div>
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
            </>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;