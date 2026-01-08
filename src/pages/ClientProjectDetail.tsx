"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, CheckCircle2, MessageSquare, FileText, Upload, Download, Send, ArrowLeft, AlertTriangle, DollarSign, Clock, ExternalLink } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { calculateSlaMetrics, SlaStatus } from '../utils/sla';
import { format } from 'date-fns';
import ServiceStatusBanner from '../components/ServiceStatusBanner';

interface Milestone {
  id: string;
  name: string;
  amount_cents: number;
  status: 'pending' | 'invoiced' | 'paid';
  order_index: number;
  stripe_invoice_id: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'awaiting_deposit' | 'active' | 'paused' | 'completed';
  progress_percent: number;
  tasks: Task[];
  messages: Message[];
  files: FileItem[];
  milestones: Milestone[]; // New field
  required_deposit_cents: number | null; // New field
  deposit_paid: boolean; // New field
  // SLA Fields
  sla_days: number | null;
  sla_start_date: string | null;
  sla_due_date: string | null;
  sla_status: SlaStatus;
  service_status: 'active' | 'paused' | 'awaiting_payment' | 'completed'; // New field
  sla_paused_at: string | null;
  sla_resume_offset_days: number;
}

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  due_date: string | null;
}

interface Message {
  id: string;
  body: string;
  sender_profile_id: string;
  created_at: string;
  profiles: { full_name: string };
}

interface FileItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploader_profile_id: string;
  created_at: string;
  profiles: { full_name: string };
}

interface PauseLog {
    id: string;
    action: 'paused' | 'resumed';
    client_acknowledged: boolean;
    created_at: string;
}

const ClientProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [showOverdueBanner, setShowOverdueBanner] = useState(false);
  const [slaMetrics, setSlaMetrics] = useState<ReturnType<typeof calculateSlaMetrics> | null>(null);
  const [latestPauseLog, setLatestPauseLog] = useState<PauseLog | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchClientData = async () => {
    if (!profile) return;
    
    // 1. Get Client ID
    const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_profile_id', profile.id)
        .single();

    if (clientError || !clientData) {
        console.error('Error fetching client record:', clientError);
        setIsLoading(false);
        return;
    }
    const currentClientId = clientData.id;
    setClientId(currentClientId);

    // 2. Check for Overdue Invoices (for non-blocking banner only)
    const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', currentClientId)
        .in('status', ['open', 'past_due', 'unpaid']);
        
    if (overdueInvoices && overdueInvoices.length > 0) {
        setShowOverdueBanner(true);
    } else {
        setShowOverdueBanner(false);
    }

    // 3. Fetch project details, tasks, messages, and files (always accessible)
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, title, description, status, progress_percent, required_deposit_cents, deposit_paid,
        sla_days, sla_start_date, sla_due_date, sla_status, service_status, sla_paused_at, sla_resume_offset_days,
        tasks (id, title, status, due_date),
        messages (id, body, created_at, sender_profile_id, profiles (full_name)),
        files (id, file_name, file_type, file_size, storage_path, created_at, profiles (full_name)),
        milestones (id, name, amount_cents, status, order_index, stripe_invoice_id)
      `)
      .eq('id', id)
      .order('created_at', { foreignTable: 'messages', ascending: true })
      .order('due_date', { foreignTable: 'tasks', ascending: true })
      .order('order_index', { foreignTable: 'milestones', ascending: true })
      .single();

    if (error) {
      console.error('Error fetching project details:', error);
      setProject(null);
    } else {
      const projectData = data as unknown as Project;
      setProject(projectData);
      
      // Calculate SLA metrics
      if (projectData.sla_days && projectData.sla_start_date && projectData.sla_due_date) {
        setSlaMetrics(calculateSlaMetrics(
          projectData.progress_percent,
          projectData.sla_days,
          projectData.sla_start_date,
          projectData.sla_due_date,
          projectData.sla_paused_at,
          projectData.sla_resume_offset_days
        ));
      } else {
          setSlaMetrics(null);
      }
      
      // Fetch latest pause log for acknowledgment
      const { data: logData } = await supabase
          .from('service_pause_logs')
          .select('id, action, client_acknowledged, created_at')
          .eq('project_id', id)
          .eq('action', 'paused')
          .eq('client_acknowledged', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
      setLatestPauseLog(logData as PauseLog || null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClientData();
  }, [id, profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [project?.messages]);

  const handleMessageSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !project || !profile) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        project_id: project.id,
        sender_profile_id: profile.id,
        body: newMessage.trim(),
      });

    if (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message.');
    } else {
      setNewMessage('');
      fetchClientData();
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload || !project || !profile || !clientId) return;

    setIsUploading(true);
    
    // 1. Upload file to storage
    const storagePath = `${clientId}/${project.id}/${Date.now()}-${fileToUpload.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('client_files')
      .upload(storagePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      alert('File upload failed.');
      setIsUploading(false);
      return;
    }

    // 2. Insert file record into database
    const { error: dbError } = await supabase
      .from('files')
      .insert({
        project_id: project.id,
        uploader_profile_id: profile.id,
        storage_path: storagePath,
        file_name: fileToUpload.name,
        file_type: fileToUpload.type,
        file_size: fileToUpload.size,
      });

    if (dbError) {
      console.error('Error saving file record:', dbError);
      // Optionally delete file from storage if DB insert fails
      await supabase.storage.from('client_files').remove([storagePath]);
      alert('Failed to save file record.');
    } else {
      setFileToUpload(null);
      alert('File uploaded successfully!');
      fetchClientData();
    }
    setIsUploading(false);
  };

  const handleFileDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('client_files')
      .download(filePath);

    if (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file.');
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleAcknowledgePause = async () => {
      if (!latestPauseLog) return;
      
      const { error } = await supabase
          .from('service_pause_logs')
          .update({ 
              client_acknowledged: true,
              client_acknowledged_at: new Date().toISOString()
          })
          .eq('id', latestPauseLog.id);
          
      if (error) {
          console.error('Error acknowledging pause:', error);
          alert('Failed to acknowledge pause.');
      } else {
          setLatestPauseLog(null); // Hide banner
      }
  };

  const completedTasks = project?.tasks.filter(t => t.status === 'done').length || 0;
  const totalTasks = project?.tasks.length || 0;

  const getProgressColor = (percent: number) => {
    if (percent === 100) return 'bg-emerald-600';
    if (percent >= 75) return 'bg-indigo-600';
    if (percent >= 50) return 'bg-amber-600';
    return 'bg-red-600';
  };
  
  const getSlaColor = (status: SlaStatus) => {
      switch (status) {
          case 'on_track': return 'bg-emerald-100 text-emerald-800';
          case 'at_risk': return 'bg-amber-100 text-amber-800';
          case 'breached': return 'bg-red-100 text-red-800';
          default: return 'bg-slate-100 text-slate-800';
      }
  };
  
  const getMilestoneStatusColor = (status: Milestone['status']) => {
      switch (status) {
          case 'paid': return 'bg-emerald-100 text-emerald-800';
          case 'invoiced': return 'bg-amber-100 text-amber-800';
          case 'pending':
          default: return 'bg-slate-100 text-slate-800';
      }
  };

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </ClientLayout>
    );
  }
  
  if (!project) {
    return (
      <ClientLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-3xl font-bold text-red-500">Project Not Found</h1>
          <p className="text-slate-500 mt-4">The project ID provided does not exist or you do not have permission to view it.</p>
        </div>
      </ClientLayout>
    );
  }
  
  const isDepositRequired = project.required_deposit_cents && project.required_deposit_cents > 0;
  const isPaused = project.service_status === 'paused' || project.service_status === 'awaiting_payment';

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/client/dashboard" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
          ← Back to Projects
        </Link>
        
        {/* Service Status Banner (Non-blocking) */}
        <ServiceStatusBanner status={project.service_status} type="project" />

        {/* Client Acknowledgment Banner */}
        {isPaused && latestPauseLog && !latestPauseLog.client_acknowledged && (
            <div className="p-4 mb-8 bg-indigo-50 border border-indigo-200 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <p className="text-sm text-indigo-800">
                        <strong>Action Required:</strong> Please acknowledge the service pause.
                    </p>
                </div>
                <button 
                    onClick={handleAcknowledgePause}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex-shrink-0 px-4 py-2 bg-white rounded-lg border border-indigo-300 hover:bg-indigo-100"
                >
                    <CheckCircle2 className="w-4 h-4 inline mr-1" /> Acknowledge
                </button>
            </div>
        )}

        {/* Overdue Warning Banner (Non-blocking) */}
        {showOverdueBanner && (
            <div className="p-4 mb-8 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                        <strong>Billing Notice:</strong> You have one or more overdue invoices. Please visit the billing section to resolve.
                    </p>
                </div>
                <Link to="/client/billing" className="text-amber-600 hover:text-amber-800 text-sm font-medium flex-shrink-0">
                    View Billing
                </Link>
            </div>
        )}

        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <Briefcase className="w-7 h-7 text-indigo-600" />
          {project.title}
        </h1>
        <p className="text-slate-500 mb-8">{project.description}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Progress, SLA & Tasks */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Progress View */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4">Project Progress</h2>
              <div className="text-4xl font-bold text-indigo-600 mb-4">{project.progress_percent}%</div>
              
              <div className="w-full bg-slate-200 rounded-full h-3 mb-4">
                <div 
                  className={`${getProgressColor(project.progress_percent)} h-3 rounded-full transition-all duration-500`} 
                  style={{ width: `${project.progress_percent}%` }}
                ></div>
              </div>

              <p className="text-sm text-slate-600">{completedTasks}/{totalTasks} Tasks Completed</p>
            </div>
            
            {/* Deposit Status */}
            {isDepositRequired && (
                <div className={`p-6 rounded-xl border ${project.deposit_paid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} shadow-lg`}>
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <DollarSign className="w-5 h-5" /> Deposit Required
                    </h2>
                    <p className="text-lg font-bold mt-1 text-slate-900">
                        Required: ${project.required_deposit_cents ? (project.required_deposit_cents / 100).toFixed(2) : 'N/A'}
                    </p>
                    <p className={`text-sm font-semibold mt-2 ${project.deposit_paid ? 'text-emerald-700' : 'text-red-700'}`}>
                        Status: {project.deposit_paid ? 'PAID' : 'AWAITING PAYMENT'}
                    </p>
                    {!project.deposit_paid && project.status === 'awaiting_deposit' && (
                        <p className="text-xs text-red-600 mt-3">
                            Project work cannot begin until the deposit invoice is paid. Please check your billing portal.
                        </p>
                    )}
                </div>
            )}
            
            {/* SLA Status (Client View) */}
            {project.sla_due_date && slaMetrics && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Clock className="w-5 h-5 text-red-600" /> Project Timeline
                    </h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <p className="text-sm font-medium text-slate-700">Status:</p>
                            <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${getSlaColor(slaMetrics.slaStatus)}`}>
                                {slaMetrics.slaStatus.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-sm font-medium text-slate-700">Due Date:</p>
                            <p className="text-sm text-slate-600">{format(new Date(project.sla_due_date), 'MMM dd, yyyy')}</p>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-sm font-medium text-slate-700">Days Remaining:</p>
                            <p className={`text-sm font-bold ${slaMetrics.daysRemaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {slaMetrics.daysRemaining}
                            </p>
                        </div>
                        {project.sla_paused_at && (
                            <div className="flex justify-between items-center text-xs text-amber-600 pt-2 border-t border-slate-100">
                                <span>SLA Paused Since:</span>
                                <span>{format(new Date(project.sla_paused_at), 'MMM dd')}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tasks List */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Tasks
              </h2>
              <div className="space-y-3">
                {project.tasks.length > 0 ? (
                  project.tasks.map(task => (
                    <div key={task.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm text-slate-900">{task.title}</p>
                        {task.due_date && <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.due_date).toLocaleDateString()}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${task.status === 'done' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No tasks defined.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Messages, Files & Milestones */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Milestones */}
            {project.milestones.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                        <DollarSign className="w-5 h-5 text-purple-600" /> Payment Milestones
                    </h2>
                    <div className="space-y-4">
                        {project.milestones.map(milestone => (
                            <div key={milestone.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-900 text-sm">{milestone.order_index}. {milestone.name}</span>
                                    <span className="text-sm text-slate-600">(${(milestone.amount_cents / 100).toFixed(2)})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getMilestoneStatusColor(milestone.status)}`}>
                                        {milestone.status}
                                    </span>
                                    {milestone.stripe_invoice_id && milestone.status !== 'paid' && (
                                        <Link 
                                            to="/client/billing" 
                                            className="text-red-600 hover:text-red-800 text-xs font-semibold flex items-center gap-1"
                                        >
                                            <ExternalLink className="w-3 h-3" /> Pay Now
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Messages Thread */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <MessageSquare className="w-5 h-5 text-indigo-600" /> Project Messages
              </h2>
              <div className="h-80 overflow-y-auto space-y-4 p-2 flex flex-col">
                {project.messages.length > 0 ? (
                  project.messages.map(message => (
                    <div key={message.id} className={`flex ${message.sender_profile_id === profile?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-xl text-sm ${message.sender_profile_id === profile?.id ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                            <div className={`text-xs mb-1 ${message.sender_profile_id === profile?.id ? 'text-indigo-200' : 'text-slate-500'}`}>
                                {message.sender_profile_id === profile?.id ? 'You' : message.profiles.full_name} - {new Date(message.created_at).toLocaleTimeString()}
                            </div>
                            {message.body}
                        </div>
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500">Start the conversation!</div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleMessageSend} className="mt-4 flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Send a message to the team..."
                  rows={2}
                  className="flex-1 p-3 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-500 outline-none"
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* Files Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <FileText className="w-5 h-5 text-purple-600" /> Project Files ({project.files.length})
              </h2>
              <div className="space-y-3">
                {project.files.length > 0 ? (
                  project.files.map(file => (
                    <div key={file.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-sm text-slate-900">{file.file_name}</p>
                          <p className="text-xs text-slate-500">{file.file_type} | {(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleFileDownload(file.storage_path, file.file_name)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" /> Download
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No files uploaded yet.</p>
                )}
              </div>
              
              <form onSubmit={handleFileUpload} className="mt-6 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-900 mb-3 text-sm">Upload New File</h3>
                <input
                  type="file"
                  onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  required
                />
                <button 
                  type="submit"
                  disabled={isUploading || !fileToUpload}
                  className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Upload File
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientProjectDetail;