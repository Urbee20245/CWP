"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Users, Loader2, Plus, Search, Building2, ArrowRight } from 'lucide-react';
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

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      restricted: 'bg-red-50 text-red-700 border-red-200',
      grace: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return map[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const filtered = clients.filter(c =>
    c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_name.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
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

        {/* Search + Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients, owners..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none transition-all"
              />
            </div>
            <span className="text-xs text-slate-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">{search ? 'No clients match your search' : 'No clients yet'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Business</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Client User</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Projects</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((client) => (
                    <tr key={client.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {client.business_name.charAt(0).toUpperCase()}
                          </div>
                          <Link to={`/admin/clients/${client.id}`} className="font-semibold text-slate-900 hover:text-indigo-600 text-sm transition-colors">
                            {client.business_name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{client.owner_name}</p>
                            {client.owner_email && client.owner_email !== client.owner_name && (
                              <p className="text-xs text-slate-400">{client.owner_email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                          {client.project_count}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusBadge(client.status)}`}>
                          {client.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/admin/clients/${client.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-indigo-600 transition-colors"
                        >
                          View <ArrowRight className="w-3.5 h-3.5" />
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

      <AddClientDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onClientAdded={fetchData} />
    </AdminLayout>
  );
};

export default AdminClientList;
