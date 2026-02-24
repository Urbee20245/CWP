"use client";

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import {
  Briefcase, Loader2, LogOut, AlertTriangle, Users, HelpCircle,
  ArrowRight, CalendarCheck, DollarSign, Zap, CheckCircle2, Clock,
  ArrowUpRight, ChevronRight
} from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import ServiceStatusBanner from '../components/ServiceStatusBanner';
import HelpPopover from '../components/HelpPopover';

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

  useEffect(() => {
    const fetchClientData = async () => {
      if (!profile) return;
      setIsLoading(true);

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name, service_status')
        .eq('owner_profile_id', profile.id)
        .single();

      if (clientError && clientError.code !== 'PGRST116') {
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

      const { data: overdueInvoices } = await supabase
          .from('invoices')
          .select('id')
          .eq('client_id', currentClientId)
          .in('status', ['open', 'past_due', 'unpaid']);

      setShowOverdueBanner(!!(overdueInvoices && overdueInvoices.length > 0));

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

    if (profile) fetchClientData();
  // Use profile.id (stable primitive) so this only re-runs when the user
  // actually changes, not on every profile object re-creation (e.g. tab focus).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const getProgressColor = (percent: number) => {
    if (percent === 100) return 'bg-emerald-500';
    if (percent >= 75) return 'bg-indigo-500';
    if (percent >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': return { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' };
      case 'active': return { label: 'Active', bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' };
      case 'paused': return { label: 'Paused', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
      default: return { label: status.replace('_', ' '), bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
    }
  };

  const renderMissingClientPanel = () => (
    <div className="max-w-lg mx-auto mt-20 p-10 bg-white rounded-2xl shadow-lg border border-slate-200 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
        <Users className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-3">Client Record Not Found</h2>
      <p className="text-sm text-slate-500 mb-8">
        Your user account is not linked to a client record. Please contact your administrator.
      </p>
      <button
        onClick={signOut}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors mx-auto"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );

  return (
    <ClientLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : isClientRecordMissing ? (
          renderMissingClientPanel()
        ) : (
          <>
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-slate-900">
                  Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
                </h1>
                <HelpPopover
                  title="Dashboard Overview"
                  content="This is your central hub. Track the status of your projects, view overdue invoices, and access key client information."
                />
              </div>
              <p className="text-slate-500 text-sm">{clientName} — Client Portal</p>
            </div>

            {/* Service Status Banner */}
            <ServiceStatusBanner status={clientServiceStatus} type="client" />

            {/* Overdue Invoice Banner */}
            {showOverdueBanner && (
              <div className="p-4 mb-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">
                    You have overdue invoices. Please resolve them to avoid service interruption.
                  </p>
                </div>
                <Link
                  to="/client/billing"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900 flex-shrink-0 transition-colors"
                >
                  View Billing <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { to: '/client/appointments', icon: CalendarCheck, label: 'Book Appointment', color: 'indigo', bg: 'bg-indigo-50', iconColor: 'text-indigo-600', desc: 'Schedule a call' },
                { to: '/client/billing', icon: DollarSign, label: 'Billing', color: 'emerald', bg: 'bg-emerald-50', iconColor: 'text-emerald-600', desc: 'Invoices & payments' },
                { to: '/client/addons', icon: Zap, label: 'Add-ons', color: 'amber', bg: 'bg-amber-50', iconColor: 'text-amber-600', desc: 'Upgrade your plan' },
                { to: '/client/help', icon: HelpCircle, label: 'Help & Guides', color: 'violet', bg: 'bg-violet-50', iconColor: 'text-violet-600', desc: 'Documentation' },
              ].map(action => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group"
                >
                  <div className={`w-9 h-9 rounded-xl ${action.bg} flex items-center justify-center mb-3`}>
                    <action.icon className={`w-4.5 h-4.5 ${action.iconColor}`} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
                </Link>
              ))}
            </div>

            {/* Projects Section */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-slate-900">Your Projects</h2>
                  {projects.length > 0 && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                      {projects.length}
                    </span>
                  )}
                </div>
              </div>

              {projects.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <Briefcase className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No projects yet</p>
                  <p className="text-xs text-slate-400 mt-1">Your projects will appear here once created</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {projects.map((project) => {
                    const statusConfig = getStatusConfig(project.status);
                    return (
                      <Link
                        key={project.id}
                        to={`/client/projects/${project.id}`}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
                      >
                        {/* Status dot */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.dot}`} />

                        {/* Project info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-sm font-semibold text-slate-900 truncate">{project.title}</h3>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {project.required_deposit_cents && project.required_deposit_cents > 0 && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  project.deposit_paid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {project.deposit_paid ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                                  {project.deposit_paid ? 'Deposit Paid' : 'Deposit Due'}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`${getProgressColor(project.progress_percent)} h-full rounded-full transition-all duration-500`}
                                style={{ width: `${project.progress_percent}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 w-8 text-right flex-shrink-0">
                              {project.progress_percent}%
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                      </Link>
                    );
                  })}
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
