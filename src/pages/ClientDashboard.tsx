"use client";

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';
import { Briefcase, Loader2, LogOut, CheckCircle2, DollarSign } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
}

const ClientDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    const fetchClientData = async () => {
      if (!profile) return;
      setIsLoading(true);

      // 1. Find the client record associated with the user's profile ID
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name')
        .eq('owner_profile_id', profile.id)
        .single();

      if (clientError || !clientData) {
        console.error('Error fetching client record:', clientError);
        setIsLoading(false);
        return;
      }
      
      setClientName(clientData.business_name);
      const clientId = clientData.id;

      // 2. Fetch projects for that client ID
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, status, progress_percent')
        .eq('client_id', clientId)
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

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome, {profile?.full_name || 'Client'}
          </h1>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 mb-12">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Business: {clientName}</h2>
            <p className="text-sm text-slate-500">Your dedicated client portal for tracking project progress and billing.</p>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" /> Your Projects
          </h2>

          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : projects.length === 0 ? (
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
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${project.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {project.status}
                    </span>
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
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;