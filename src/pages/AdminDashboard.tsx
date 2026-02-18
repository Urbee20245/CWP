"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import {
  Users, Briefcase, DollarSign, Loader2, ArrowRight, Zap, MessageSquare,
  Bell, Clock, TrendingUp, CalendarCheck, Phone, Video, User, ArrowUpRight,
  MoreHorizontal
} from 'lucide-react';
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
        .select(`id, note, reminder_date, clients (id, business_name)`)
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

  const statCards = [
    {
      label: 'Total Clients',
      value: stats.totalClients,
      icon: Users,
      href: '/admin/clients',
      color: 'indigo',
      bg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      trend: null,
    },
    {
      label: 'Active Projects',
      value: stats.activeProjects,
      icon: Briefcase,
      href: '/admin/projects',
      color: 'emerald',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      trend: null,
    },
    {
      label: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: TrendingUp,
      href: '/admin/billing/revenue',
      color: 'violet',
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      trend: null,
    },
    {
      label: 'Add-on Requests',
      value: stats.pendingAddonRequests,
      icon: Zap,
      href: '/admin/clients',
      color: 'amber',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      trend: stats.pendingAddonRequests > 0 ? 'New' : null,
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <HelpPopover
                title="Agency Overview Dashboard"
                content="Monitor key performance indicators (KPIs) including client count, active projects, revenue, and pending requests."
              />
            </div>
            <p className="text-slate-500 text-sm">Here's what's happening with your agency today.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => (
                <Link
                  key={card.label}
                  to={card.href}
                  className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {card.trend && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{card.trend}</span>
                      )}
                      <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{card.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{card.label}</p>
                </Link>
              ))}
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CalendarCheck className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-slate-900">Upcoming Appointments</h2>
                  {upcomingAppointments.length > 0 && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                      {upcomingAppointments.length}
                    </span>
                  )}
                </div>
                <Link
                  to="/admin/appointments"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="p-5">
                {upcomingAppointments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {upcomingAppointments.map(appointment => {
                      const appointmentDate = parseISO(appointment.appointment_time);
                      const isFree = appointment.billing_type === 'free_monthly' || appointment.price_cents === 0;

                      const typeConfig = {
                        phone: { icon: Phone, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Phone' },
                        video: { icon: Video, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Video' },
                        in_person: { icon: User, color: 'text-purple-600', bg: 'bg-purple-50', label: 'In Person' },
                      };
                      const type = typeConfig[appointment.appointment_type] || typeConfig.phone;

                      return (
                        <Link
                          key={appointment.id}
                          to={`/admin/clients/${appointment.clients.id}`}
                          className="block p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
                        >
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${type.bg} mb-3`}>
                            <type.icon className={`w-3.5 h-3.5 ${type.color}`} />
                            <span className={`text-xs font-semibold ${type.color}`}>{type.label}</span>
                          </div>
                          <p className="font-semibold text-sm text-slate-900 truncate mb-1">
                            {appointment.clients.business_name}
                          </p>
                          <p className="text-base font-bold text-indigo-700">
                            {format(appointmentDate, 'MMM d')}
                          </p>
                          <p className="text-xs text-slate-500">{format(appointmentDate, 'h:mm a')}</p>
                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                            <span className="text-xs text-slate-400">{appointment.duration_minutes}m</span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                              isFree ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isFree ? 'FREE' : `$${((appointment.price_cents || 0) / 100).toFixed(0)}`}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <CalendarCheck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">No upcoming appointments</p>
                    <p className="text-xs text-slate-400 mt-0.5">Client bookings will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3-column activity grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Reminders */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-bold text-slate-900">Reminders</h2>
                  </div>
                  {overdueReminders.length > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                      {overdueReminders.length} overdue
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto max-h-72 p-3 space-y-2">
                  {reminders.length > 0 ? reminders.map(reminder => {
                    const isOverdue = isPast(new Date(reminder.reminder_date));
                    return (
                      <Link
                        key={reminder.id}
                        to={`/admin/clients/${reminder.clients.id}?tab=reminders`}
                        className={`flex items-start justify-between gap-2 p-3 rounded-xl border transition-all ${
                          isOverdue
                            ? 'bg-red-50 border-red-200 hover:bg-red-100'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {reminder.clients.business_name}
                          </p>
                          <p className={`text-xs mt-0.5 truncate ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                            {reminder.note}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Clock className={`w-3 h-3 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`} />
                          <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                            {format(new Date(reminder.reminder_date), 'MMM d')}
                          </span>
                        </div>
                      </Link>
                    );
                  }) : (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                      <Bell className="w-8 h-8 text-slate-200 mb-2" />
                      <p className="text-sm text-slate-400">No pending reminders</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <h2 className="text-sm font-bold text-slate-900">Recent Messages</h2>
                  </div>
                  {recentMessages.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      {recentMessages.length} new
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto max-h-72 p-3 space-y-2">
                  {recentMessages.length > 0 ? recentMessages.map(message => {
                    const clientName = message.project_threads.projects.clients.business_name;
                    const projectId = message.project_threads.project_id;
                    const projectTitle = message.project_threads.projects.title;

                    return (
                      <Link
                        key={message.id}
                        to={`/admin/projects/${projectId}`}
                        className="block p-3 rounded-xl border bg-blue-50 border-blue-200 hover:bg-blue-100 transition-all"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-semibold text-slate-900 truncate">{clientName}</p>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {format(new Date(message.created_at), 'h:mma')}
                          </span>
                        </div>
                        <p className="text-xs text-blue-700 truncate mb-1">{projectTitle}</p>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          "{message.body.substring(0, 80)}{message.body.length > 80 ? '...' : ''}"
                        </p>
                      </Link>
                    );
                  }) : (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                      <MessageSquare className="w-8 h-8 text-slate-200 mb-2" />
                      <p className="text-sm text-slate-400">No new messages (24h)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
                </div>
                <div className="p-3 space-y-1.5">
                  {[
                    { to: '/admin/clients', icon: Users, label: 'Manage Clients', desc: 'View and edit client details', color: 'indigo' },
                    { to: '/admin/projects', icon: Briefcase, label: 'View Projects', desc: 'Track project progress', color: 'emerald' },
                    { to: '/admin/billing/revenue', icon: DollarSign, label: 'Revenue Report', desc: 'View financial analytics', color: 'violet' },
                    { to: '/admin/billing/products', icon: Zap, label: 'Billing Setup', desc: 'Configure products & pricing', color: 'amber' },
                  ].map(action => (
                    <Link
                      key={action.to}
                      to={action.to}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all group"
                    >
                      <div className={`w-8 h-8 rounded-lg bg-${action.color}-50 flex items-center justify-center flex-shrink-0`}>
                        <action.icon className={`w-4 h-4 text-${action.color}-600`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                        <p className="text-xs text-slate-400 truncate">{action.desc}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                    </Link>
                  ))}
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
