"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Users, Briefcase, DollarSign, Loader2, LogOut, Plus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AddClientDialog from '../components/AddClientDialog';
import { Profile } from '../types/auth';

interface ClientSummary {
  id: string;
  business_name: string;
  status: string;
  owner_profile_id: string;
  owner_name: string;
  project_count: number;
}

const AdminDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [stats, setStats] = useState({ totalClients: 0, activeProjects: 0, totalRevenue: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    // Fetch Clients and their associated profile names
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id, business_name, status, owner_profile_id,
        profiles (full_name),
        projects (count)
      `);

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
    } else {
      const formattedClients: ClientSummary[] = clientsData.map(client => ({
        id: client.id,
        business_name: client.business_name,
        status: client.status,
        owner_profile_id: client.owner_profile_id,
        owner_name: (client.profiles as Profile)?.full_name || 'N/A',
        project_count: (client.projects as any[])[0]?.count || 0,
      }));
      setClients(formattedClients);
      setStats(prev => ({ ...prev, totalClients: formattedClients.length }));
    }

    // Fetch Active Projects Count
    const { count: activeProjectsCount, error: projectsError } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    if (!projectsError) {
      setStats(prev => ({ ...prev, activeProjects: activeProjectsCount || 0 }));
    }

    // Fetch Total Revenue (Paid Invoices)
    const { data: revenueData, error: revenueError } = await supabase
      .from('invoices')
      .select('amount')
      .eq('status', 'paid');

    if (!revenueError && revenueData) {
      const totalRevenue = revenueData.reduce((sum, invoice) => sum + invoice.amount, 0) / 100; // Assuming amount is in cents
      setStats(prev => ({ ...prev, totalRevenue }));
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = [
    { title: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Active Projects', value: stats.activeProjects, icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {statCards.map((card, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
                <div className={`w-8 h-8 rounded-full ${card.bg} flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-1 text-3xl font-bold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Clients List */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-900">Client Management</h2>
            <button 
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> Add Client
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Business Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Projects</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{client.business_name}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{client.owner_name}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{client.project_count}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${client.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link to={`/admin/clients/${client.id}`} className="text-indigo-600 hover:text-indigo-900">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <AddClientDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onClientAdded={fetchData}
      />
    </AdminLayout>
  );
};

export default AdminDashboard;