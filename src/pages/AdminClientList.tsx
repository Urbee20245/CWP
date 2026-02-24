"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Users, Loader2, Plus, Search, ArrowRight, Building2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AddClientDialog from '../components/AddClientDialog';

interface ClientSummary {
  id: string;
  business_name: string;
  status: string;
  owner_profile_id: string;
  owner_name: string;
  owner_email: string;
  project_count: number;
}

const AdminClientList: React.FC = () => {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, business_name, status, owner_profile_id, projects(count)');

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        setClients([]);
        return;
      }

      const profileIds = (clientsData || [])
        .map((c: any) => c.owner_profile_id)
        .filter(Boolean);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds);

      const profileMap = Object.fromEntries(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      const formattedClients: ClientSummary[] = (clientsData || []).map((client: any) => {
        const profile = profileMap[client.owner_profile_id];
        return {
          id: client.id,
          business_name: client.business_name,
          status: client.status,
          owner_profile_id: client.owner_profile_id,
          owner_name: profile?.full_name || profile?.email || 'No user linked',
          owner_email: profile?.email || '',
          project_count: client.projects?.[0]?.count || 0,
        };
      });

      setClients(formattedClients);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':    return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Active' };
      case 'restricted':return { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Restricted' };
      case 'grace':     return { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Grace Period' };
      default:          return { bg: 'bg-slate-50',   text: 'text-slate-600',   dot: 'bg-slate-400',   label: status };
    }
  };

  const filtered = clients.filter(c =>
    c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_name.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_email.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount   = clients.filter(c => c.status === 'active').length;
  const totalProjects = clients.reduce((sum, c) => sum + c.project_count, 0);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Client Management</h1>
              <p className="text-sm text-slate-500 mt-0.5">{clients.length} total clients</p>
            </div>
            <button
              onClick={() => setIsDialogOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Client
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { label: 'Total Clients',   value: clients.length,  color: 'text-slate-900' },
              { label: 'Active',          value: activeCount,     color: 'text-emerald-600' },
              { label: 'Total Projects',  value: totalProjects,   color: 'text-indigo-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-slate-50"
              />
            </div>
            <p className="text-xs text-slate-400 sm:ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Building2 className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-500">
                {search ? 'No clients match your search' : 'No clients yet'}
              </p>
              {!search && (
                <button
                  onClick={() => setIsDialogOpen(true)}
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Add your first client
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Business</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Client User</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Projects</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((client) => {
                    const statusConfig = getStatusConfig(client.status);
                    const initials = client.business_name.slice(0, 2).toUpperCase();
                    return (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {initials}
                            </div>
                            <Link to={`/admin/clients/${client.id}`} className="font-semibold text-sm text-slate-900 hover:text-indigo-600 transition-colors">
                              {client.business_name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-slate-800">{client.owner_name}</p>
                          {client.owner_email && client.owner_email !== client.owner_name && (
                            <p className="text-xs text-slate-400 mt-0.5">{client.owner_email}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                            {client.project_count}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <Link
                            to={`/admin/clients/${client.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            View <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AddClientDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onClientAdded={fetchData} />
    </AdminLayout>
  );
};

export default AdminClientList;
