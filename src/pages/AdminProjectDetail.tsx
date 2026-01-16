"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, CheckCircle2, MessageSquare, FileText, Upload, Trash2, Plus, ArrowLeft, Clock, AlertTriangle, Download, Send, DollarSign, ExternalLink, Pause, Play, X, Zap } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Profile } from '../types/auth';
import { calculateSlaMetrics, calculateSlaDueDate, SlaStatus, adjustSlaDueDate } from '../utils/sla';
import { format, differenceInDays, parseISO } from 'date-fns';
import { AdminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';
import { mapProjectDTO, ProjectDTO, MilestoneDTO, TaskDTO, FileItemDTO, ThreadDTO } from '../utils/projectMapper'; // Import DTO and Mapper
import { ensureArray } from '../utils/dataNormalization';

// Define types locally based on DTOs for clarity
type Milestone = MilestoneDTO;
type ProjectServiceStatus = ProjectDTO['service_status'];
type Thread = ThreadDTO;
type Task = TaskDTO;
type FileItem = FileItemDTO;

interface PauseLog {
    id: string;
    action: 'paused' | 'resumed';
    internal_note: string | null;
    client_acknowledged: boolean;
    created_at: string;
}

interface DepositSummary {
  id: string;
  amount_cents: number;
  status: 'paid' | 'pending' | 'failed' | 'applied';
  stripe_invoice_id: string | null;
  applied_to_invoice_id: string | null; // Use this to check if applied
  created_at: string;
}

const AdminProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDTO | null>(null); // Use ProjectDTO
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null); // New state for fetch errors
  const [newProgress, setNewProgress] = useState(0);
  const [newMessage, setNewMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  // Thread State
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  
  // Task State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  
  // SLA State
  const [slaDays, setSlaDays] = useState<number | ''>('');
  const [slaStartDate, setSlaStartDate] = useState<string>('');
  const [slaMetrics, setSlaMetrics] = useState<ReturnType<typeof calculateSlaMetrics> | null>(null);
  
  // Milestone State
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneAmount, setNewMilestoneAmount] = useState<number | ''>('');
  const [requiredDeposit, setRequiredDeposit] = useState<number | ''>('');
  
  // Deposit Application State
  const [deposits, setDeposits] = useState<DepositSummary[]>([]);
  const [selectedDepositId, setSelectedDepositId] = useState('');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
  
  // Service Control State
  const [serviceActionNote, setServiceActionNote] = useState('');
  const [pauseLogs, setPauseLogs] = useState<PauseLog[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchProjectData = async () => {
    if (!id) return;
    setIsLoading(true);
    setFetchError(null);
    
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        clients (business_name, billing_email),
        tasks (id, title, status, due_date),
        files (id, file_name, file_type, file_size, storage_path, created_at, profiles (full_name)),
        milestones (id, name, amount_cents, status, order_index, stripe_invoice_id),
        project_threads (
            id, title, status, created_at, created_by,
            messages (id, body, created_at, sender_profile_id, profiles (full_name))
        )
      `)
      .eq('id', id)
      .order('due_date', { foreignTable: 'tasks', ascending: true })
      .order('order_index', { foreignTable: 'milestones', ascending: true })
      .order('created_at', { foreignTable: 'project_threads', ascending: false })
      .order('created_at', { foreignTable: 'project_threads.messages', ascending: true })
      .maybeSingle(); // <-- FIX: Use maybeSingle()

    if (error) {
      console.error('Error fetching project details:', error);
      setProject(null);
      setFetchError(error.message || 'Failed to load project data.');
    } else {
      try {
        // If data is null (maybeSingle() returned no row), mapProjectDTO will throw, which is caught below.
        const projectDTO = mapProjectDTO(data);
        setProject(projectDTO);
        setNewProgress(projectDTO.progress_percent);
        setSlaDays(projectDTO.sla_days || '');
        setSlaStartDate(projectDTO.sla_start_date ? format(new Date(projectDTO.sla_start_date), 'yyyy-MM-dd') : '');
        setRequiredDeposit(projectDTO.required_deposit_cents ? projectDTO.required_deposit_cents / 100 : '');
        
        // Set active thread to the first open thread, or the first thread if none are open
        if (projectDTO.threads.length > 0) {
            const openThread = projectDTO.threads.find(t => t.status === 'open');
            setActiveThreadId(openThread?.id || projectDTO.threads[0].id);
        } else {
            setActiveThreadId(null);
        }
        
        // Calculate SLA metrics immediately
        if (projectDTO.sla_days && projectDTO.sla_start_date && projectDTO.sla_due_date) {
          const metrics = calculateSlaMetrics(
            projectDTO.progress_percent,
            projectDTO.sla_days,
            projectDTO.sla_start_date,
            projectDTO.sla_due_date,
            projectDTO.sla_paused_at,
            projectDTO.sla_resume_offset_days
          );
          setSlaMetrics(metrics);
          // Update DB status if calculated status differs (optional auto-sync)
          if (metrics.slaStatus !== projectDTO.sla_status) {
              await supabase.from('projects').update({ sla_status: metrics.slaStatus }).eq('id', id);
          }
        } else {
            setSlaMetrics(null);
        }
        
        // Fetch Pause Logs
        const { data: logsData, error: logsError } = await supabase
            .from('service_pause_logs')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false });
            
        if (logsError) {
            console.error('Error fetching pause logs:', logsError);
        } else {
            setPauseLogs(ensureArray(logsData) as PauseLog[] ?? []);
        }
        
        // Fetch Deposits for this client
        const { data: depositsData, error: depositsError } = await supabase
            .from('deposits')
            .select('*')
            .eq('client_id', projectDTO.client_id)
            .order('created_at', { ascending: false });
            
        if (depositsError) {
            console.error('Error fetching deposits:', depositsError);
        } else {
            setDeposits(ensureArray(depositsData) as DepositSummary[] ?? []);
        }
        
      } catch (mapError: any) {
          console.error("Error mapping project DTO:", mapError);
          setProject(null);
          setFetchError(mapError.message || 'Failed to process project data.');
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);
  
  useEffect(() => {
    // Scroll to bottom whenever the active thread changes or new messages arrive
    scrollToBottom();
  }, [activeThreadId, project?.threads.find(t => t.id === activeThreadId)?.messages.length]);

  const handleProgressUpdate = async () => {
    if (!project) return;
    setIsUpdating(true);
    
    // Rule: Project cannot reach 100% unless all milestones are paid
    if (newProgress === 100) {
        const unpaidMilestones = project.milestones.filter(m => m.status !== 'paid');
        if (unpaidMilestones.length > 0) {
            alert(`Cannot set progress to 100%. ${unpaidMilestones.length} milestones are still unpaid.`);
            setNewProgress(project.progress_percent); // Revert local state
            setIsUpdating(false);
            return;
        }
    }
    
    const { error } = await supabase
      .from('projects')
      .update({ progress_percent: newProgress })
      .eq('id', project.id);

    if (error) {
      console.error('Error updating progress:', error);
      alert('Failed to update progress.');
    } else {
      alert('Progress updated successfully!');
      fetchProjectData(); // Re-fetch data to update UI
    }
    setIsUpdating(false);
  };
  
  const handleSlaUpdate = async () => {
    if (!project || !slaDays || !slaStartDate) return;
    setIsUpdating(true);
    
    const days = typeof slaDays === 'string' ? parseInt(slaDays) : slaDays;
    if (days <= 0) {
        alert("SLA days must be positive.");
        setIsUpdating(false);
        return;
    }
    
    const newSlaDueDate = calculateSlaDueDate(slaStartDate, days);
    
    const { error } = await supabase
      .from('projects')
      .update({ 
          sla_days: days,
          sla_start_date: new Date(slaStartDate).toISOString(),
          sla_due_date: newSlaDueDate,
          sla_status: 'on_track', // Reset status on manual update
          sla_resume_offset_days: 0, // Reset offset days
          sla_paused_at: null,
      })
      .eq('id', project.id);

    if (error) {
      console.error('Error updating SLA:', error);
      alert('Failed to update SLA.');
    } else {
      alert('SLA updated successfully!');
      fetchProjectData();
    }
    setIsUpdating(false);
  };

  const handleMessageSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !project || !user || !activeThreadId) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        thread_id: activeThreadId,
        sender_profile_id: user.id,
        body: newMessage.trim(),
      });

    if (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message.');
    } else {
      setNewMessage('');
      fetchProjectData();
    }
  };
  
  const handleMessageDelete = async (messageId: string) => {
    if (!window.confirm("Are you sure you want to delete this message? This action cannot be undone.")) return;
    
    setIsUpdating(true);
    
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
        
    if (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message.');
    } else {
        alert('Message deleted.');
        fetchProjectData();
    }
    setIsUpdating(false);
  };
  
  const handleTaskCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !project || !user) return;
    
    setIsUpdating(true);
    
    const { error } = await supabase
        .from('tasks')
        .insert({
            project_id: project.id,
            title: newTaskTitle.trim(),
            due_date: newTaskDueDate || null,
            status: 'todo',
            created_by: user.id,
        });
        
    if (error) {
        console.error('Error creating task:', error);
        alert('Failed to create task.');
    } else {
        setNewTaskTitle('');
        setNewTaskDueDate('');
        fetchProjectData();
    }
    setIsUpdating(false);
  };
  
  const handleTaskStatusUpdate = async (taskId: string, newStatus: Task['status']) => {
    setIsUpdating(true);
    const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);
        
    if (error) {
        console.error('Error updating task status:', error);
        alert('Failed to update task status.');
    } else {
        fetchProjectData();
    }
    setIsUpdating(false);
  };
  
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload || !project || !user) return;

    setIsUploading(true);
    
    // 1. Upload file to storage
    const storagePath = `${project.client_id}/${project.id}/${Date.now()}-${fileToUpload.name}`;

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
        uploader_profile_id: user.id,
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
      fetchProjectData();
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
  
  const handleFileDelete = async (fileId: string, storagePath: string) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    
    setIsUpdating(true);
    
    // 1. Delete from storage
    const { error: storageError } = await supabase.storage
        .from('client_files')
        .remove([storagePath]);
        
    if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        alert('Failed to delete file from storage.');
        setIsUpdating(false);
        return;
    }
    
    // 2. Delete record from database
    const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);
        
    if (dbError) {
        console.error('Error deleting file record:', dbError);
        alert('Failed to delete file record.');
    } else {
        alert('File deleted successfully!');
        fetchProjectData();
    }
    setIsUpdating(false);
  };
  
  // --- Milestone Handlers ---
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneName.trim() || !newMilestoneAmount || !project) return;
    
    setIsUpdating(true);
    
    const amountCents = Math.round(newMilestoneAmount as number * 100);
    
    const { error } = await supabase
        .from('milestones')
        .insert({
            project_id: project.id,
            name: newMilestoneName.trim(),
            amount_cents: amountCents,
            order_index: project.milestones.length + 1,
            status: 'pending',
        });
        
    if (error) {
        console.error('Error creating milestone:', error);
        alert('Failed to create milestone.');
    } else {
        setNewMilestoneName('');
        setNewMilestoneAmount('');
        fetchClientData();
    }
    setIsUpdating(false);
  };
  
  const handleInvoiceMilestone = async (milestone: Milestone) => {
    if (!project || !project.client_id) return;
    setIsUpdating(true);
    
    try {
        const result = await AdminService.createMilestoneInvoice(
            project.client_id,
            milestone.id,
            milestone.amount_cents,
            milestone.name,
            project.id
        );
        
        alert(`Milestone '${milestone.name}' invoiced successfully! Hosted URL: ${result.hosted_url}`);
        fetchClientData();
    } catch (e: any) {
        alert(`Failed to invoice milestone: ${e.message}`);
    } finally {
        setIsUpdating(false);
    }
  };
  
  const handleApplyDepositToMilestone = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDepositId || !selectedMilestoneId || !project) return;
      
      setIsUpdating(true);
      
      try {
          await AdminService.applyDepositToMilestone(
              selectedDepositId,
              selectedMilestoneId,
              project.id
          );
          
          alert('Deposit applied and milestone marked as paid!');
          setSelectedDepositId('');
          setSelectedMilestoneId('');
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to apply deposit: ${e.message}`);
      } finally {
          setIsUpdating(false);
      }
  };
  
  const handleUpdateDepositRequirement = async () => {
    if (!project) return;
    setIsUpdating(true);
    
    const amountCents = Math.round((requiredDeposit as number) * 100);
    
    let updates: Partial<ProjectDTO> = {
        required_deposit_cents: amountCents,
    };
    
    if (amountCents > 0 && !project.deposit_paid) {
        updates.status = 'awaiting_deposit';
    } else if (amountCents === 0) {
        updates.deposit_paid = false;
        if (project.status === 'awaiting_deposit') {
            updates.status = 'draft'; // Revert status if deposit is removed
        }
    }
    
    const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', project.id);
        
    if (error) {
        console.error('Error updating deposit requirement:', error);
        alert('Failed to update deposit requirement.');
    } else {
        alert('Deposit requirement updated!');
        fetchClientData();
    }
    setIsUpdating(false);
  };
  
  const handleSendDepositInvoice = async () => {
    if (!project || !project.client_id || !project.required_deposit_cents) return;
    setIsUpdating(true);
    
    try {
        const result = await AdminService.createDepositInvoice(
            project.client_id,
            project.required_deposit_cents / 100,
            `Required Project Deposit for ${project.title}`,
            project.id
        );
        
        alert(`Deposit invoice sent! Client must pay via hosted URL: ${result.hosted_url}`);
        fetchClientData();
    } catch (e: any) {
        alert(`Failed to send deposit invoice: ${e.message}`);
    } finally {
        setIsUpdating(false);
    }
  };
  
  const handleUpdateProjectStatus = async (newStatus: ProjectDTO['status']) => {
    if (!project) return;
    setIsUpdating(true);
    
    const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);
        
    if (error) {
        console.error('Error updating project status:', error);
        alert('Failed to update project status.');
    } else {
        alert(`Project status updated to ${newStatus}!`);
        fetchClientData();
    }
    setIsUpdating(false);
  };
  
  const handleUpdateServiceStatus = async (newStatus: ProjectServiceStatus) => {
    if (!project) return;
    setIsUpdating(true);
    
    const action = newStatus === 'paused' || newStatus === 'awaiting_payment' ? 'paused' : 'resumed';
    
    let updates: Partial<ProjectDTO> = {
        service_status: newStatus,
        sla_paused_at: action === 'paused' ? new Date().toISOString() : null,
    };
    
    // If resuming, calculate the offset days and update the due date
    if (action === 'resumed' && project.sla_paused_at && project.sla_due_date) {
        const pausedSince = parseISO(project.sla_paused_at);
        const pauseDurationDays = differenceInDays(new Date(), pausedSince);
        const newOffsetDays = project.sla_resume_offset_days + pauseDurationDays;
        
        updates.sla_resume_offset_days = newOffsetDays;
        updates.sla_due_date = adjustSlaDueDate(project.sla_due_date, pauseDurationDays);
        updates.sla_paused_at = null;
    }

    try {
        // 1. Update project status and SLA
        const { error: updateError } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', project.id);
            
        if (updateError) throw updateError;

        // 2. Log the action
        const { error: logError } = await supabase
            .from('service_pause_logs')
            .insert({
                client_id: project.client_id,
                project_id: project.id,
                action: action,
                internal_note: serviceActionNote,
            });
            
        if (logError) console.error('Error logging service action:', logError);

        alert(`Project service status updated to ${newStatus}!`);
        setServiceActionNote('');
        fetchClientData();
    } catch (e: any) {
        console.error('Error updating service status:', e);
        alert('Failed to update service status.');
    } finally {
        setIsUpdating(false);
    }
  };
  
  // --- Thread Management ---
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
  
  const handleCloseThread = async (threadId: string) => {
      if (!window.confirm("Are you sure you want to close this thread? It will be marked as 'closed'.")) return;
      setIsUpdating(true);
      
      try {
          const { error } = await supabase
              .from('project_threads')
              .update({ status: 'closed' })
              .eq('id', threadId);
              
          if (error) throw error;
          
          // Try to switch to the next open thread or the first thread
          const nextOpenThread = project?.threads.find(t => t.id !== threadId && t.status === 'open');
          setActiveThreadId(nextOpenThread?.id || project?.threads.find(t => t.id !== threadId)?.id || null);
          
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to close thread: ${e.message}`);
      } finally {
          setIsUpdating(false);
      }
  };
  
  const handleReopenThread = async (threadId: string) => {
      setIsUpdating(true);
      try {
          const { error } = await supabase
              .from('project_threads')
              .update({ status: 'open' })
              .eq('id', threadId);
              
          if (error) throw error;
          setActiveThreadId(threadId);
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to reopen thread: ${e.message}`);
      } finally {
          setIsUpdating(false);
      }
  };
  
  const handleThreadDelete = async (threadId: string) => {
      if (!window.confirm("WARNING: Are you sure you want to permanently delete this thread and all its messages? This action cannot be undone.")) return;
      setIsUpdating(true);
      
      try {
          // Deleting the thread record will cascade delete all messages
          const { error } = await supabase
              .from('project_threads')
              .delete()
              .eq('id', threadId);
              
          if (error) throw error;
          
          // Switch to the first remaining thread or null
          const remainingThreads = project?.threads.filter(t => t.id !== threadId) || [];
          setActiveThreadId(remainingThreads.length > 0 ? remainingThreads[0].id : null);
          
          alert('Thread deleted successfully.');
          fetchClientData();
      } catch (e: any) {
          alert(`Failed to delete thread: ${e.message}`);
      } finally {
          setIsUpdating(false);
      }
  };
  
  const activeThread = project?.threads.find(t => t.id === activeThreadId);

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