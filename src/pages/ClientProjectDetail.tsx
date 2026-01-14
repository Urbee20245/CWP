"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, CheckCircle2, MessageSquare, FileText, Upload, Download, Send, ArrowLeft, AlertTriangle, DollarSign, Clock, ExternalLink, Bot, ChevronDown, ChevronUp, Plus, X, HelpCircle } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../hooks/useAuth';
import { calculateSlaMetrics, SlaStatus } from '../utils/sla';
import { format } from 'date-fns';
import ServiceStatusBanner from '../components/ServiceStatusBanner';
import { mapProjectDTO, ProjectDTO, MilestoneDTO, TaskDTO, FileItemDTO, ThreadDTO } from '../utils/projectMapper'; // Import DTO and Mapper
import { ClientBillingService } from '../services/clientBillingService'; // Import ClientBillingService
import { ensureArray } from '../utils/dataNormalization';
import { marked } from 'marked';
import HelpPopover from '../components/HelpPopover'; // Import HelpPopover

// Define types locally based on DTOs for clarity
type Milestone = MilestoneDTO;
type Thread = ThreadDTO;
type Task = TaskDTO;
type FileItem = FileItemDTO;

interface PauseLog {
    id: string;
    action: 'paused' | 'resumed';
    client_acknowledged: boolean;
    created_at: string;
}

interface Document {
    id: string;
    document_type: string;
    content: string;
    version: number;
    created_at: string;
}

const ClientProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const [project, setProject] = useState<ProjectDTO | null>(null); // Use ProjectDTO
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [showOverdueBanner, setShowOverdueBanner] = useState(false);
  const [slaMetrics, setSlaMetrics] = useState<ReturnType<typeof calculateSlaMetrics> | null>(null);
  const [latestPauseLog, setLatestPauseLog] = useState<PauseLog | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'tasks' | 'files' | 'milestones' | 'documents'>('documents'); // Default to documents
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [isPayingDeposit, setIsPayingDeposit] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false); // New state for help popover
  
  // Thread State
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchClientData = async () => {
    if (!profile) {
        setIsLoading(false);
        return;
    }
    
    // 1. Get Client ID
    const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_profile_id', profile.id)
        .single();

    if (clientError || !clientData) {
        console.error('Client record not found:', clientError);
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
        files (id, file_name, file_type, file_size, storage_path, created_at, profiles (full_name)),
        milestones (id, name, amount_cents, status, order_index, stripe_invoice_id),
        project_threads (
            id, title, status, created_at, created_by,
            messages (id, body, created_at, sender_profile_id, profiles (full_name, role))
        )
      `)
      .eq('id', id)
      .eq('client_id', currentClientId) // Explicitly filter by client ID for security and correctness
      .order('due_date', { foreignTable: 'tasks', ascending: true })
      .order('order_index', { foreignTable: 'milestones', ascending: true })
      .order('created_at', { foreignTable: 'project_threads', ascending: false })
      .order('created_at', { foreignTable: 'project_threads.messages', ascending: true }) // Nested order for messages
      .single();

    if (error) {
      console.error('Error fetching project details:', error);
      setProject(null);
    } else {
      try {
        const projectDTO = mapProjectDTO(data);
        setProject(projectDTO);
        
        // Set active thread to the first open thread, or the first thread if none are open
        if (projectDTO.threads.length > 0) {
            const openThread = projectDTO.threads.find(t => t.status === 'open');
            setActiveThreadId(openThread?.id || projectDTO.threads[0].id);
        } else {
            setActiveThreadId(null);
        }
        
        // Calculate SLA metrics
        if (projectDTO.sla_days && projectDTO.sla_start_date && projectDTO.sla_due_date) {
          setSlaMetrics(calculateSlaMetrics(
            projectDTO.progress_percent,
            projectDTO.sla_days,
            projectDTO.sla_start_date,
            projectDTO.sla_due_date,
            projectDTO.sla_paused_at,
            projectDTO.sla_resume_offset_days
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
        
        // 4. Fetch shared documents (project-specific and master documents)
        const { data: docsData } = await supabase
            .from('documents')
            .select('id, document_type, content, version, created_at')
            .eq('project_id', id)
            .eq('is_client_visible', true)
            .order('created_at', { ascending: false });
            
        // Also fetch master T&C if active
        const { data: masterDocsData } = await supabase
            .from('master_legal_documents')
            .select('id, document_type, content, version, created_at')
            .eq('document_type', 'Master Terms & Conditions')
            .eq('is_active', true)
            .limit(1);
            
        const allDocs = [
            ...ensureArray(docsData) as Document[],
            ...ensureArray(masterDocsData) as Document[]
        ];
            
        setDocuments(allDocs);
      } catch (mapError) {
          console.error("Error mapping project DTO:", mapError);
          setProject(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClientData();
  }, [id, profile]);

  useEffect(() => {
    // Scroll to bottom whenever the active thread changes or new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadId, project?.threads.find(t => t.id === activeThreadId)?.messages.length]);

  const handleMessageSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !project || !profile || !activeThreadId) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        thread_id: activeThreadId,
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
  
  const handleCreateThread = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newThreadTitle.trim() || !project || !user) return;
      setIsCreatingThread(true);
      
      try {
          const { data, error } = await supabase
              .from('project_threads')
              .insert({
                  project_id: project.id,
                  title: newThreadTitle.trim(),
                  created_by: user.id,
                  status: 'open',
              })
              .select()
              .single();
              
          if (error) throw error;
          
          setNewThreadTitle('');
          setActiveThreadId(data.id);
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to create thread: ${e.message}`);
      } finally {
          setIsCreatingThread(false);
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
  
  const handlePayDeposit = async () => {
      if (!project || !clientId || !project.required_deposit_cents) return;
      
      setIsPayingDeposit(true);
      
      const amountCents = project.required_deposit_cents;
      const description = `Project Deposit: ${project.title}`;
      
      // Construct dynamic success/cancel URLs to return to this page
      const currentUrl = window.location.href;
      
      try {
          const result = await ClientBillingService.createDepositCheckoutSession(
              clientId,
              project.id,
              amountCents,
              description,
              currentUrl, // Success URL
              currentUrl  // Cancel URL
          );
          
          // Redirect to Stripe Checkout
          window.location.href = result.checkout_url;
          
      } catch (e: any) {
          alert(`Failed to initiate payment: ${e.message}`);
      } finally {
          setIsPayingDeposit(false);
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
  
  const renderDocumentContent = (content: string) => {
    // Simple markdown to HTML conversion for display
    let html = content;
    try {
        // Use marked for robust markdown rendering
        html = marked.parse(content);
    } catch (e) {
        html = `<p style='color: red;'>Error rendering markdown: ${e}</p>`;
    }
    return <div dangerouslySetInnerHTML={{ __html: html }} className="prose max-w-none text-sm text-slate-700" />;
  };
  
  const activeThread = project?.threads.find(t => t.id === activeThreadId);

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

  const renderHelpIcon = (message: string) => (
      <HelpPopover 
          title="Section Info"
          content={message}
          className="ml-2"
      />
  );

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

        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3 relative">
          <Briefcase className="w-7 h-7 text-indigo-600" />
          {project.title}
          <HelpPopover 
              title="Project Detail View"
              content="Track progress, view milestones, communicate with the team via threads, and share/download project files."
          />
        </h1>
        <p className="text-slate-500 mb-8">{project.description}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Progress, SLA & Tasks */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Progress View */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                Project Progress
                {renderHelpIcon("Progress is updated by the project manager based on task completion and milestone delivery.")}
              </h2>
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
                    
                    {!project.deposit_paid && (
                        <button 
                            onClick={handlePayDeposit}
                            disabled={isPayingDeposit}
                            className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isPayingDeposit ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" /> Redirecting...
                                </>
                            ) : (
                                <>
                                    <DollarSign className="w-5 h-5" /> Pay Deposit Now
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}
            
            {/* SLA Status (Client View) */}
            {project.sla_due_date && slaMetrics && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Clock className="w-5 h-5 text-red-600" /> Project Timeline
                        {renderHelpIcon("The Service Level Agreement (SLA) tracks the project timeline. It pauses when the service status is paused or awaiting payment.")}
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
                {renderHelpIcon("Tasks are the individual steps required to complete the project. They are managed by the admin team.")}
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

          {/* Right Column: Tabs */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Tabs Navigation */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'documents' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        Documents ({documents.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'messages' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        Messages
                    </button>
                    <button
                        onClick={() => setActiveTab('milestones')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'milestones' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        Milestones
                    </button>
                    <button
                        onClick={() => setActiveTab('files')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'files' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        Files
                    </button>
                </nav>
            </div>
            
            {/* Tab Content */}
            
            {/* Documents Tab */}
            {activeTab === 'documents' && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Bot className="w-5 h-5 text-emerald-600" /> Shared Documents
                        {renderHelpIcon("This section contains legal documents (T&Cs, Privacy Policy) and strategy documents shared by the admin team.")}
                    </h2>
                    
                    {documents.length === 0 ? (
                        <div className="text-center p-8 bg-slate-50 rounded-lg text-slate-500">
                            No legal drafts or documents have been shared by the admin team yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {documents.map(doc => (
                                <div key={doc.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-slate-900">{doc.document_type} (v{doc.version})</p>
                                        <p className="text-xs text-slate-500">{format(new Date(doc.created_at), 'MMM dd, yyyy')}</p>
                                    </div>
                                    
                                    {expandedDocId === doc.id && (
                                        <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg">
                                            {renderDocumentContent(doc.content)}
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
                                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                                    >
                                        {expandedDocId === doc.id ? 'Hide Document' : 'View Document'}
                                        {expandedDocId === doc.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* Messages Tab */}
            {activeTab === 'messages' && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <MessageSquare className="w-5 h-5 text-indigo-600" /> Project Threads
                        {renderHelpIcon("Use threads to discuss specific topics with the project team. Start a new thread for a new topic.")}
                    </h2>
                    
                    {/* Thread Selector */}
                    <div className="flex gap-3 mb-4 overflow-x-auto pb-2 border-b border-slate-100">
                        {project.threads.map(thread => (
                            <button
                                key={thread.id}
                                onClick={() => setActiveThreadId(thread.id)}
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                                    activeThreadId === thread.id
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : thread.status === 'closed'
                                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {thread.title} ({thread.messages.length})
                                {thread.status === 'closed' && <X className="w-3 h-3 inline ml-1" />}
                            </button>
                        ))}
                    </div>
                    
                    {/* Active Thread Title */}
                    {activeThread && (
                        <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <h3 className="font-bold text-slate-900 text-lg">{activeThread.title}</h3>
                            {activeThread.status === 'closed' && (
                                <p className="text-sm text-red-600 mt-1">This thread is closed. Please start a new one for a new topic.</p>
                            )}
                        </div>
                    )}
                    
                    {/* Message List */}
                    <div className="h-80 overflow-y-auto space-y-4 p-2 flex flex-col">
                        {activeThread?.messages.length ? (
                        activeThread.messages.map(message => {
                            const isClient = message.sender_profile_id === profile?.id;
                            const senderRole = (message.profiles as any)?.role; // Access role from the nested profile object
                            
                            let senderName = 'Unknown';
                            if (isClient) {
                                senderName = 'You';
                            } else if (senderRole === 'admin') {
                                senderName = 'CWP Support'; // Override for admin messages
                            } else {
                                senderName = message.profiles?.full_name || 'Admin';
                            }

                            return (
                                <div key={message.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-xl text-sm ${isClient ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                                        <div className={`text-xs mb-1 ${isClient ? 'text-indigo-200' : 'text-slate-500'}`}>
                                            {senderName} - {new Date(message.created_at).toLocaleTimeString()}
                                        </div>
                                        {message.body}
                                    </div>
                                </div>
                            );
                        })
                        ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-500">Start the conversation!</div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    {/* Message Input */}
                    {activeThread?.status === 'open' ? (
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
                    ) : (
                        <div className="mt-4 p-3 bg-slate-100 text-slate-600 rounded-lg text-sm text-center">
                            This thread is closed.
                        </div>
                    )}
                    
                    {/* New Thread Form */}
                    <form onSubmit={handleCreateThread} className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                        <input
                            type="text"
                            value={newThreadTitle}
                            onChange={(e) => setNewThreadTitle(e.target.value)}
                            placeholder="Start a new discussion thread..."
                            className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                            required
                            disabled={isCreatingThread}
                        />
                        <button 
                            type="submit"
                            disabled={isCreatingThread || !newThreadTitle}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isCreatingThread ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            New Thread
                        </button>
                    </form>
                </div>
            )}
            
            {/* Milestones Tab */}
            {activeTab === 'milestones' && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <DollarSign className="w-5 h-5 text-purple-600" /> Payment Milestones
                        {renderHelpIcon("Milestones are the payment schedule for your project. Once a milestone is invoiced, you will receive an email notification.")}
                    </h2>
                    <div className="space-y-4">
                        {project.milestones.length > 0 ? (
                            project.milestones.map(milestone => (
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
                            ))
                        ) : (
                            <div className="text-center p-8 bg-slate-50 rounded-lg text-slate-500">No payment milestones defined for this project.</div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Files Tab */}
            {activeTab === 'files' && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <FileText className="w-5 h-5 text-purple-600" /> Project Files ({project.files.length})
                        {renderHelpIcon("Upload files for the admin team (e.g., logos, content drafts) or download files shared by the team.")}
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
            )}
          </div>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientProjectDetail;