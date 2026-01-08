"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Briefcase, Loader2, ArrowRight, Users, Clock } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { calculateSlaMetrics } from '../utils/sla';

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
  client_id: string;
  clients: { business_name: string };
  sla_days: number | null;
  sla_start_date: string | null;
  sla_due_date: string | null;
}

const AdminProjectList: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id, title, status, progress_percent, client_id, sla_days, sla_start_date, sla_due_date,
        clients (business_name)
      `)
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
    } else {
      setProjects(projectsData || []);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-indigo-100 text-indigo-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'on_hold': return 'bg-amber-100 text-amber-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };
  
  const getSlaStatusColor = (project: ProjectSummary) => {
      if (!project.sla_days || !project.sla_start_date || !project.sla_due_date) {
          return 'text-slate-500';
      }
      const metrics = calculateSlaMetrics(
          project.progress_percent,
          project.sla_days,
          project.sla_start_date,
          project.sla_due_date
      );
      switch (metrics.slaStatus) {
          case 'breached': return 'text-red-600';
          case 'at_risk': return 'text-amber-600';
          case 'on_track': return 'text-emerald-600';
          default: return 'text-slate-500';
      }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <Briefcase className="w-7 h-7 text-indigo-600" /> All Projects ({projects.length})
        </h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Project Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SLA</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-slate-50 cursor-pointer">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-indigo-600 hover:text-indigo-800">
                        <Link to={`/admin/projects/${project.id}`} className="block">
                            {project.title}
                        </Link>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                        <Link to={`/admin/clients/${project.client_id}`} className="text-slate-600 hover:text-indigo-600">
                            {project.clients.business_name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-200 rounded-full h-2.5">
                                <div 
                                    className="bg-indigo-600 h-2.5 rounded-full" 
                                    style={{ width: `${project.progress_percent}%` }}
                                ></div>
                            </div>
                            <span className="text-xs font-bold">{project.progress_percent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(project.status)}`}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {project.sla_due_date ? (
                              <div className={`flex items-center gap-1 font-bold ${getSlaStatusColor(project)}`}>
                                  <Clock className="w-4 h-4" />
                                  {calculateSlaMetrics(project.progress_percent, project.sla_days, project.sla_start_date, project.sla_due_date).slaStatus.replace('_', ' ')}
                              </div>
                          ) : (
                              <span className="text-slate-400">N/A</span>
                          )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link to={`/admin/projects/${project.id}`} className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end gap-1">
                          View <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminProjectList;