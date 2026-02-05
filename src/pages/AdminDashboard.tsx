"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Users, Briefcase, DollarSign, Loader2, ArrowRight, Zap, MessageSquare, Bell, Clock, TrendingUp, CalendarCheck, Phone, Video, User } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import HelpPopover from '../components/HelpPopover';
import { format, isPast, parseISO } from 'date-fns';

interface ReminderSummary {
    id: string;
    note: string;
    reminder_date: string;
    clients: { id: string; business_name: string };
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

interface UpcomingAppointment {
    id: string;
    appointment_time: string;
    duration_minutes: number;
    appointment_type: 'phone' | 'video' | 'in_person';
    status: string;
    billing_type: string | null;
    price_cents: number | null;
    clients: {
        id: string;
        business_name: string;
    };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ totalClients: 0, activeProjects: 0, totalRevenue: 0, pendingAddonRequests: 0 });
  const [reminders, setReminders] = useState<ReminderSummary[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    const { count: activeProjectsCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { data: revenueData } = await supabase
      .from('invoices')
      .select('amount_due')
      .eq('status', 'paid');

    const { count: pendingAddonRequestsCount } = await supabase
        .from('client_addon_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'requested');

    const { data: remindersData, error: remindersError } = await supabase
        .from('client_reminders')
        .select(`
            id, note, reminder_date,
            clients (id, business_name)
        `)
        .eq('is_completed', false)
        .order('reminder_date', { ascending: true })
        .limit(5);

    if (remindersError) {
        console.error('Error fetching reminders:', remindersError);
    } else {
        setReminders(remindersData as ReminderSummary[] || []);
    }

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
        .eq('profiles.role', 'client')
        .order('created_at', { ascending: false })
        .limit(5);

    if (messagesError) {
        console.error('Error fetching recent messages:', messagesError);
    } else {
        setRecentMessages(messagesData as RecentMessage[] || []);
    }

    // Fetch upcoming appointments
    const now = new Date().toISOString();
    const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
            id, appointment_time, duration_minutes, appointment_type, status, billing_type, price_cents,
            clients (id, business_name)
        `)
        .gte('appointment_time', now)
        .eq('status', 'scheduled')
        .order('appointment_time', { ascending: true })
        .limit(5);

    if (appointmentsError) {
        console.error('Error fetching upcoming appointments:', appointmentsError);
    } else {
        setUpcomingAppointments(appointmentsData as UpcomingAppointment[] || []);
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

  const overdueReminders = reminders.filter(r => isPast(new Date(r.reminder_date)));
  const upcomingReminders = reminders.filter(r => !isPast(new Date(r.reminder_date)));

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <HelpPopover
              title="Agency Overview Dashboard"
              content="Monitor key performance indicators (KPIs) including client count, active projects, revenue, and pending requests."
            />
          </div>
          <p className="text-slate-500 text-sm">Welcome back. Here's your agency overview.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* Stats Grid - 4 equal cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Link to="/admin/clients" className="bg-white rounded-xl p-5 border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalClients}</p>
                <p className="text-sm text-slate-500">Total Clients</p>
              </Link>

              <Link to="/admin/projects" className="bg-white rounded-xl p-5 border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-emerald-600" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{stats.activeProjects}</p>
                <p className="text-sm text-slate-500">Active Projects</p>
              </Link>

              <Link to="/admin/billing/revenue" className="bg-white rounded-xl p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-slate-900">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                <p className="text-sm text-slate-500">Total Revenue</p>
              </Link>

              <Link to="/admin/clients" className="bg-white rounded-xl p-5 border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.pendingAddonRequests > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <Zap className={`w-5 h-5 ${stats.pendingAddonRequests > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                  </div>
                  {stats.pendingAddonRequests > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">New</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-slate-900">{stats.pendingAddonRequests}</p>
                <p className="text-sm text-slate-500">Add-on Requests</p>
              </Link>
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-indigo-500" />
                  <h2 className="font-semibold text-slate-900">Upcoming Appointments</h2>
                </div>
                {upcomingAppointments.length > 0 && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                    {upcomingAppointments.length} scheduled
                  </span>
                )}
              </div>
              <div className="p-4">
                {upcomingAppointments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {upcomingAppointments.map(appointment => {
                      const appointmentDate = parseISO(appointment.appointment_time);
                      const isFree = appointment.billing_type === 'free_monthly' || appointment.price_cents === 0;

                      return (
                        <Link
                          key={appointment.id}
                          to={`/admin/clients/${appointment.clients.id}`}
                          className="block p-4 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-all"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {appointment.appointment_type === 'phone' ? (
                              <Phone className="w-4 h-4 text-emerald-600" />
                            ) : appointment.appointment_type === 'video' ? (
                              <Video className="w-4 h-4 text-blue-600" />
                            ) : (
                              <User className="w-4 h-4 text-purple-600" />
                            )}
                            <span className="text-xs font-medium text-slate-600 capitalize">
                              {appointment.appointment_type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="font-semibold text-sm text-slate-900 truncate">
                            {appointment.clients.business_name}
                          </p>
                          <p className="text-lg font-bold text-indigo-700 mt-1">
                            {format(appointmentDate, 'MMM d, h:mm a')}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-500">
                              {appointment.duration_minutes} min
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isFree
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isFree ? 'FREE' : `$${((appointment.price_cents || 0) / 100).toFixed(0)}`}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CalendarCheck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No upcoming appointments</p>
                    <p className="text-xs text-slate-400 mt-1">Appointments booked by clients will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Section - 3 equal columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Pending Reminders */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    <h2 className="font-semibold text-slate-900">Reminders</h2>
                  </div>
                  {overdueReminders.length > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      {overdueReminders.length} overdue
                    </span>
                  )}
                </div>
                <div className="p-3 max-h-72 overflow-y-auto">
                  {reminders.length > 0 ? (
                    <div className="space-y-2">
                      {reminders.map(reminder => {
                        const isOverdue = isPast(new Date(reminder.reminder_date));
                        return (
                          <Link
                            key={reminder.id}
                            to={`/admin/clients/${reminder.clients.id}?tab=reminders`}
                            className={`block p-3 rounded-lg border transition-all ${
                              isOverdue
                                ? 'bg-red-50 border-red-200 hover:bg-red-100'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-900 truncate">
                                  {reminder.clients.business_name}
                                </p>
                                <p className={`text-xs mt-0.5 truncate ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                                  {reminder.note}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Clock className={`w-3 h-3 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`} />
                                <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                                  {format(new Date(reminder.reminder_date), 'MMM d')}
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No pending reminders</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Messages */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <h2 className="font-semibold text-slate-900">Messages</h2>
                  </div>
                  {recentMessages.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {recentMessages.length} new
                    </span>
                  )}
                </div>
                <div className="p-3 max-h-72 overflow-y-auto">
                  {recentMessages.length > 0 ? (
                    <div className="space-y-2">
                      {recentMessages.map(message => {
                        const clientName = message.project_threads.projects.clients.business_name;
                        const projectId = message.project_threads.project_id;
                        const projectTitle = message.project_threads.projects.title;

                        return (
                          <Link
                            key={message.id}
                            to={`/admin/projects/${projectId}`}
                            className="block p-3 rounded-lg border bg-blue-50 border-blue-200 hover:bg-blue-100 transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-900 truncate">
                                  {clientName}
                                </p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {projectTitle}
                                </p>
                              </div>
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                {format(new Date(message.created_at), 'h:mma')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                              "{message.body.substring(0, 80)}{message.body.length > 80 ? '...' : ''}"
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No new messages (24h)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">Quick Actions</h2>
                </div>
                <div className="p-3">
                  <div className="space-y-2">
                    <Link
                      to="/admin/clients"
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100">
                        <Users className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">Manage Clients</p>
                        <p className="text-xs text-slate-500">View and edit client details</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                    </Link>

                    <Link
                      to="/admin/projects"
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100">
                        <Briefcase className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">View Projects</p>
                        <p className="text-xs text-slate-500">Track project progress</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                    </Link>

                    <Link
                      to="/admin/billing/revenue"
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-purple-50 hover:border-purple-200 transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100">
                        <DollarSign className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">Revenue Report</p>
                        <p className="text-xs text-slate-500">View financial analytics</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500" />
                    </Link>

                    <Link
                      to="/admin/billing/products"
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-200 transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100">
                        <Zap className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">Billing Setup</p>
                        <p className="text-xs text-slate-500">Configure products & pricing</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
