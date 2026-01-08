"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Users, Briefcase, DollarSign, Loader2, ArrowRight, BarChart3, Zap, MessageSquare } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ totalClients: 0, activeProjects: 0, totalRevenue: 0, newMessages: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
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
      
    // Fetch New Messages Count (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: newMessagesCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    let totalRevenue = 0;
    if (revenueData) {
      totalRevenue = revenueData.reduce((sum, invoice) => sum + invoice.amount_due, 0) / 100;
    }

    setStats({
        totalClients: totalClients || 0,
        activeProjects: activeProjectsCount || 0,
        totalRevenue: totalRevenue,
        newMessages: newMessagesCount || 0,
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
    { title: 'New Messages (24h)', value: stats.newMessages, icon: MessageSquare, color: 'text-red-600', bg: 'bg-red-50', link: '/admin/projects' },
  ];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <Zap className="w-7 h-7 text-indigo-600" /> Agency Overview
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