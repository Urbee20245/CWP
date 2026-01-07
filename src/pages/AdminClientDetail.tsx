"use client";

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Briefcase, FileText, DollarSign, MessageSquare, Phone, Mail, MapPin } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Profile } from '@/types/auth';

interface Client {
  id: string;
  business_name: string;
  phone: string;
  status: string;
  notes: string;
  owner_profile_id: string;
  profiles: Profile;
  projects: ProjectSummary[];
  invoices: InvoiceSummary[];
}

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
}

interface InvoiceSummary {
  id: string;
  amount: number;
  status: string;
  hosted_invoice_url: string;
}

const AdminClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchClientData = async () => {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          profiles (id, full_name, email),
          projects (id, title, status, progress_percent),
          invoices (id, amount, status, hosted_invoice_url)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching client details:', error);
        setClient(null);
      } else {
        setClient(data as unknown as Client);
      }
      setIsLoading(false);
    };

    fetchClientData();
  }, [id]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </AdminLayout>
    );
  }

  if (!client) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-3xl font-bold text-red-500">Client Not Found</h1>
        </div>
      </AdminLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-800';
      case 'paused': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/admin/dashboard" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
          ← Back to Clients
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-8">{client.business_name}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Client Info & Notes */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-600">
                <Users className="w-5 h-5" /> Client Details
              </h2>
              <div className="space-y-3 text-sm">
                <p className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-medium text-slate-600">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(client.status)}`}>
                    {client.status}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-600">User Email:</span>
                  <a href={`mailto:${client.profiles.email}`} className="text-indigo-600 hover:underline">{client.profiles.email}</a>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-600">Phone:</span>
                  <a href={`tel:${client.phone}`} className="text-slate-900 hover:underline">{client.phone || 'N/A'}</a>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-600">Contact Name:</span>
                  <span className="text-slate-900">{client.profiles.full_name}</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900">
                <FileText className="w-5 h-5 text-slate-500" /> Internal Notes
              </h2>
              <textarea
                className="w-full h-40 p-3 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-500 outline-none"
                defaultValue={client.notes || 'No notes recorded.'}
                placeholder="Add internal notes here..."
              />
              <button className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                Save Notes
              </button>
            </div>
          </div>

          {/* Right Column: Projects & Billing */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Projects List */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                <Briefcase className="w-5 h-5 text-emerald-600" /> Projects ({client.projects.length})
              </h2>
              <div className="space-y-4">
                {client.projects.length > 0 ? (
                  client.projects.map(project => (
                    <Link 
                      key={project.id} 
                      to={`/admin/projects/${project.id}`}
                      className="block p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-900">{project.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                          <div 
                            className="bg-indigo-600 h-2.5 rounded-full" 
                            style={{ width: `${project.progress_percent}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-slate-600 w-10 text-right">{project.progress_percent}%</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No projects found for this client.</p>
                )}
              </div>
              <button className="mt-6 w-full py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
                <Plus className="w-4 h-4 inline mr-2" /> Add New Project
              </button>
            </div>

            {/* Billing/Invoices List */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                <DollarSign className="w-5 h-5 text-purple-600" /> Invoices ({client.invoices.length})
              </h2>
              <div className="space-y-3">
                {client.invoices.length > 0 ? (
                  client.invoices.map(invoice => (
                    <div key={invoice.id} className="flex justify-between items-center text-sm p-2 border-b border-slate-50 last:border-b-0">
                      <span className="font-medium text-slate-900">${(invoice.amount / 100).toFixed(2)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                      <a 
                        href={invoice.hosted_invoice_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-indigo-600 hover:underline"
                      >
                        View Link
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No invoices found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminClientDetail;