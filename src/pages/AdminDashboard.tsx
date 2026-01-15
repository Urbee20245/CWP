"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Users, Briefcase, DollarSign, Loader2, ArrowRight, BarChart3, Zap, MessageSquare, Bell, HelpCircle, Clock } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import HelpPopover from '../components/HelpPopover'; // Import HelpPopover
import { format, isPast } from 'date-fns';

interface ReminderSummary {
    id: string;
    note: string;
    reminder_date: string;
    clients: { business_name: string };
}

interface RecentMessage {
    id: string;
    body: string;
    created_at: string;
    thread_id: string;
    project_threads: {
        project_id: string;
        projects: {
            title: string;
            clients: {
                business_name: string;
                id: string;
            };
        };
    };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ totalClients: 0, activeProjects: 0, totalRevenue: 0, pendingAddonRequests: 0 });
  const [reminders, setReminders] = useState<ReminderSummary[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]); // NEW STATE
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch Total Clients Count
    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    // Fetch Active Projects Count
    const { count: activeProjectsCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    // Fetch Total Revenue (Paid Invoices - simplified for dashboard)
    const { data: revenueData } = await supabase
      .from('invoices')
      .select('amount_due')
      .eq('status', 'paid');
      
    // Fetch Pending Add-on Requests Count
    const { count: pendingAddonRequestsCount } = await supabase
        .from('client_addon_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'requested');
        
    // Fetch Pending Reminders
    const { data: remindersData, error: remindersError } = await supabase
        .from('client_reminders')
        .select(`
            id, note, reminder_date,
            clients (business_name)
        `)
        .eq('is_completed', false)
        .order('reminder_date', { ascending: true })
        .limit(5);
        
    if (remindersError) {
        console.error('Error fetching reminders:', remindersError);
    } else {
        setReminders(remindersData as ReminderSummary[] || []);
    }
    
    // NEW: Fetch Recent Client Messages (last 24 hours)
    const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
            id, body, created_at, thread_id,
            project_threads (
                project_id,
                projects (
                    title,
                    clients (business_name, id)
                )
            ),
            profiles!sender_profile_id (role)
        `)
        .gte('created_at', twentyFourHoursAgo)
        .eq('profiles.role', 'client') // Only messages sent by clients
        .order('created_at', { ascending: false })
        .limit(5);
        
    if (messagesError) {
        console.error('Error fetching recent messages:', messagesError);
    } else {
        setRecentMessages(messagesData as RecentMessage[] || []);
    }

    let totalRevenue = 0;
    if (revenueData) {
      totalRevenue = revenueData.reduce((sum, invoice) => sum + invoice.amount_due, 0) / 100;
    }

    setStats({
        totalClients: totalClients || 0,
        activeProjects: activeProjectsCount || 0,
        totalRevenue: totalRevenue,
        pendingAddonRequests: pendingAddonRequestsCount || 0,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = [
    { title: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/admin/clients' },
    { title: 'Active Projects', value: stats.activeProjects, icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50', link: '/admin/projects' },
    { title: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', link: '/admin/billing/revenue' },
    { title: 'New Messages (24h)', value: recentMessages.length, icon: MessageSquare, color: recentMessages.length > 0 ? 'text-red-600' : 'text-slate-600', bg: recentMessages.length > 0 ? 'bg-red-50' : 'bg-slate-50', link: '/admin/projects' },
  ];
  
  const notificationCard = {
      title: 'Pending Add-on Requests',
      value: stats.pendingAddonRequests,
      icon: Zap,
      color: stats.pendingAddonRequests > 0 ? 'text-amber-600' : 'text-slate-600',
      bg: stats.pendingAddonRequests > 0 ? 'bg-amber-50' : 'bg-slate-50',
      link: '/admin/clients', // Link to client list where requests can be reviewed
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3 relative">
          <Zap className="w-7 h-7 text-indigo-600" /> Agency Overview
          <HelpPopover 
              title="Agency Overview Dashboard"
              content="Monitor key performance indicators (KPIs) including client count, active projects, revenue, and pending requests."
          />
        </h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              {statCards.map((card, index) => (
                <Link to={card.link} key={index} className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl hover:border-indigo-200 transition-all block">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">{card.title}</p>
                    <div className={`w-8 h-8 rounded-full ${card.bg} flex items-center justify-center ${card.color}`}>
                      <card.icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="mt-1 text-3xl font-bold text-slate-900">{card.value}</p>
                  <div className="mt-3 text-sm font-medium text-indigo-600 flex items-center gap-1">
                    View Details <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Notification Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <Link to={notificationCard.link} className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl hover:border-amber-200 transition-all block">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">{notificationCard.title}</p>
                    <div className={`w-8 h-8 rounded-full ${notificationCard.bg} flex items-center justify-center ${notificationCard.color}`}>
                      <notificationCard.icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="mt-1 text-3xl font-bold text-slate-900">{notificationCard.value}</p>
                  <div className="mt-3 text-sm font-medium text-indigo-600 flex items-center gap-1">
                    Review Requests <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
                
                {/* Recent Messages List */}
                <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <MessageSquare className="w-5 h-5 text-red-600" /> Recent Client Messages ({recentMessages.length})
                    </h2>
                    <div className="space-y-3 max-h-40 overflow-y-auto">
                        {recentMessages.length > 0 ? (
                            recentMessages.map(message => {
                                const clientName = message.project_threads.projects.clients.business_name;
                                const projectId = message.project_threads.projects.clients.id;
                                const projectTitle = message.project_threads.projects.title;
                                
                                return (
                                    <Link 
                                        key={message.id} 
                                        to={`/admin/projects/${message.project_threads.projects.clients.id}`} // Link to project detail
                                        className="p-3 rounded-lg border flex justify-between items-center bg-red-50 border-red-200 hover:bg-red-100 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-bold text-sm text-slate-900 truncate">
                                                {clientName} - {projectTitle}
                                            </p>
                                            <p className="text-xs text-slate-600 mt-1 truncate">
                                                "{message.body}"
                                            </p>
                                        </div>
                                        <Clock className="w-4 h-4 text-red-600 flex-shrink-0" />
                                    </Link>
                                );
                            })
                        ) : (
                            <p className="text-slate-500 text-sm">No new client messages in the last 24 hours.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-4">
                    Quick Actions
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link to="/admin/clients" className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center hover:bg-indigo-50 hover:border-indigo-300 transition-colors">
                        <Users className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                        <span className="text-sm font-semibold text-slate-700">Manage Clients</span>
                    </Link>
                    <Link to="/admin/projects" className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center hover:bg-emerald-50 hover:border-emerald-300 transition-colors">
                        <Briefcase className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                        <span className="text-sm font-semibold text-slate-700">View Projects</span>
                    </Link>
                    <Link to="/admin/billing/revenue" className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center hover:bg-purple-50 hover:border-purple-300 transition-colors">
                        <BarChart3 className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                        <span className="text-sm font-semibold text-slate-700">Revenue Report</span>
                    </Link>
                    <Link to="/admin/billing/products" className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center hover:bg-red-50 hover:border-red-300 transition-colors">
                        <DollarSign className="w-6 h-6 text-red-600 mx-auto mb-2" />
                        <span className="text-sm font-semibold text-slate-700">Billing Setup</span>
                    </Link>
                </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;