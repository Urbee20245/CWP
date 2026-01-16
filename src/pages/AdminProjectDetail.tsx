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
import { marked } from 'marked';

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
  const [activeTab, setActiveTab] = useState<'messages' | 'milestones' | 'files'>('messages');
  
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

  const fetchProjectData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setFetchError(null);

    try {
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
                    messages (id, body, created_at, sender_profile_id, profiles (full_name, role))
                )
            `)
            .eq('id', id)
            .order('due_date', { foreignTable: 'tasks', ascending: true })
            .order('order_index', { foreignTable: 'milestones', ascending: true })
            .order('created_at', { foreignTable: 'project_threads', ascending: false })
            .order('created_at', { foreignTable: 'project_threads.messages', ascending: true })
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Project not found.");

        const projectDTO = mapProjectDTO(data);
        setProject(projectDTO);
        setNewProgress(projectDTO.progress_percent);
        setSlaDays(projectDTO.sla_days || '');
        setSlaStartDate(projectDTO.sla_start_date ? format(new Date(projectDTO.sla_start_date), 'yyyy-MM-dd') : '');
        setRequiredDeposit(projectDTO.required_deposit_cents ? projectDTO.required_deposit_cents / 100 : '');

        if (projectDTO.threads.length > 0) {
            const openThread = projectDTO.threads.find(t => t.status === 'open');
            setActiveThreadId(openThread?.id || projectDTO.threads[0].id);
        } else {
            setActiveThreadId(null);
        }

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
            if (metrics.slaStatus !== projectDTO.sla_status) {
                await supabase.from('projects').update({ sla_status: metrics.slaStatus }).eq('id', id);
            }
        } else {
            setSlaMetrics(null);
        }

        const { data: logsData, error: logsError } = await supabase
            .from('service_pause_logs')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false });
        if (logsError) throw logsError;
        setPauseLogs(ensureArray(logsData) as PauseLog[] ?? []);

        const { data: depositsData, error: depositsError } = await supabase
            .from('deposits')
            .select('*')
            .eq('client_id', projectDTO.client_id)
            .order('created_at', { ascending: false });
        if (depositsError) throw depositsError;
        setDeposits(ensureArray(depositsData) as DepositSummary[] ?? []);

    } catch (err: any) {
        console.error('Error fetching project details:', err);
        setProject(null);
        setFetchError(err.message || 'Failed to load project data.');
    } finally {
        setIsLoading(false);
    }
  }, [id]);
  
  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);
  
  useEffect(() => {
    scrollToBottom();
  }, [activeThreadId, project?.threads.find(t => t.id === activeThreadId)?.messages.length]);

  const handleProgressUpdate = async () => {
    if (!project) return;
    setIsUpdating(true);
    
    if (newProgress === 100) {
        const unpaidMilestones = project.milestones.filter(m => m.status !== 'paid');
        if (unpaidMilestones.length > 0) {
            alert(`Cannot set progress to 100%. ${unpaidMilestones.length} milestones are still unpaid.`);
            setNewProgress(project.progress_percent);
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
      fetchProjectData();
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
          sla_status: 'on_track',
          sla_resume_offset_days: 0,
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
    
    const { error: storageError } = await supabase.storage
        .from('client_files')
        .remove([storagePath]);
        
    if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        alert('Failed to delete file from storage.');
        setIsUpdating(false);
        return;
    }
    
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
        fetchProjectData();
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
        fetchProjectData();
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
          fetchProjectData();
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
            updates.status = 'draft';
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
        fetchProjectData();
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
        fetchProjectData();
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
        fetchProjectData();
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
    
    if (action === 'resumed' && project.sla_paused_at && project.sla_due_date) {
        const pausedSince = parseISO(project.sla_paused_at);
        const pauseDurationDays = differenceInDays(new Date(), pausedSince);
        const newOffsetDays = project.sla_resume_offset_days + pauseDurationDays;
        
        updates.sla_resume_offset_days = newOffsetDays;
        updates.sla_due_date = adjustSlaDueDate(project.sla_due_date, pauseDurationDays);
        updates.sla_paused_at = null;
    }

    try {
        const { error: updateError } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', project.id);
            
        if (updateError) throw updateError;

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
        fetchProjectData();
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
          fetchProjectData();
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
          
          const nextOpenThread = project?.threads.find(t => t.id !== threadId && t.status === 'open');
          setActiveThreadId(nextOpenThread?.id || project?.threads.find(t => t.id !== threadId)?.id || null);
          
          fetchProjectData();
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
          fetchProjectData();
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
          
          const remainingThreads = project?.threads.filter(t => t.id !== threadId) || [];
          setActiveThreadId(remainingThreads.length > 0 ? remainingThreads[0].id : null);
          
          alert('Thread deleted successfully.');
          fetchProjectData();
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
    let html = content;
    try {
        html = marked.parse(content);
    } catch (e) {
        html = `<p style='color: red;'>Error rendering markdown: ${e}</p>`;
    }
    return <div dangerouslySetInnerHTML={{ __html: html }} className="prose max-w-none text-sm text-slate-700" />;
  };
  
  const isDepositRequired = project.required_deposit_cents && project.required_deposit_cents > 0;
  const isPaused = project.service_status === 'paused' || project.service_status === 'awaiting_payment';

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/admin/projects" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
          ← Back to Project List
        </Link>
        
        <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Briefcase className="w-7 h-7 text-indigo-600" />
                {project.title}
            </h1>
            <Link to={`/admin/clients/${project.client_id}`} className="text-sm font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1">
                Client: {project.clients.business_name} <ExternalLink className="w-4 h-4" />
            </Link>
        </div>
        <p className="text-slate-500 mb-8">{project.description}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Progress, SLA & Tasks */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Progress Update */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4">Update Progress</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Current Progress: {newProgress}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={newProgress}
                  onChange={(e) => setNewProgress(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer range-lg"
                  disabled={isUpdating}
                />
              </div>
              <button
                onClick={handleProgressUpdate}
                disabled={isUpdating}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Update Progress
              </button>
            </div>
            
            {/* SLA Management */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4">SLA Management</h2>
              
              {project.sla_due_date && slaMetrics ? (
                  <div className="mb-4 p-3 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Current SLA Status</p>
                      <div className="flex justify-between items-center">
                          <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${getSlaColor(slaMetrics.slaStatus)}`}>
                              {slaMetrics.slaStatus.replace('_', ' ')}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{slaMetrics.daysRemaining} Days Left</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Due: {format(new Date(project.sla_due_date), 'MMM dd, yyyy')}</p>
                      {project.sla_paused_at && (
                          <p className="text-xs text-amber-600 mt-1">Paused Since: {format(parseISO(project.sla_paused_at), 'MMM dd')}</p>
                      )}
                  </div>
              ) : (
                  <p className="text-sm text-slate-500 mb-4">SLA not configured.</p>
              )}
              
              <h3 className="font-bold text-sm mb-2">Set/Reset SLA</h3>
              <div className="space-y-3">
                  <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Total SLA Days</label>
                      <input
                          type="number"
                          value={slaDays}
                          onChange={(e) => setSlaDays(parseInt(e.target.value) || '')}
                          placeholder="e.g., 45"
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                          disabled={isUpdating}
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                      <input
                          type="date"
                          value={slaStartDate}
                          onChange={(e) => setSlaStartDate(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                          disabled={isUpdating}
                      />
                  </div>
                  <button
                      onClick={handleSlaUpdate}
                      disabled={isUpdating || !slaDays || !slaStartDate}
                      className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                      <Clock className="w-4 h-4" /> Set/Reset SLA
                  </button>
              </div>
            </div>
            
            {/* Task Management */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4">Task Management</h2>
              
              <h3 className="font-bold text-sm mb-2">Add New Task</h3>
              <form onSubmit={handleTaskCreation} className="space-y-3 mb-6">
                  <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task Title"
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                      required
                      disabled={isUpdating}
                  />
                  <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                      disabled={isUpdating}
                  />
                  <button
                      type="submit"
                      disabled={isUpdating || !newTaskTitle}
                      className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                      <Plus className="w-4 h-4" /> Add Task
                  </button>
              </form>
              
              <h3 className="font-bold text-sm mb-2 border-t border-slate-100 pt-4">Task List ({totalTasks})</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {project.tasks.length > 0 ? (
                  project.tasks.map(task => (
                    <div key={task.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-medium text-sm text-slate-900 truncate">{task.title}</p>
                        {task.due_date && <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.due_date).toLocaleDateString()}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                          <select
                              value={task.status}
                              onChange={(e) => handleTaskStatusUpdate(task.id, e.target.value as Task['status'])}
                              className={`px-2 py-1 rounded-full text-xs font-semibold border ${task.status === 'done' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}
                              disabled={isUpdating}
                          >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Done</option>
                              <option value="blocked">Blocked</option>
                          </select>
                          <button 
                              onClick={() => handleTaskStatusUpdate(task.id, 'done')}
                              disabled={isUpdating || task.status === 'done'}
                              className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                              title="Mark as Done"
                          >
                              <CheckCircle2 className="w-4 h-4" />
                          </button>
                      </div>
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
            
            {/* Messages Tab */}
            {activeTab === 'messages' && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <MessageSquare className="w-5 h-5 text-indigo-600" /> Project Threads
                    </h2>
                    
                    {/* Thread Selector */}
                    <div className="flex gap-3 mb-4 overflow-x-auto pb-2 border-b border-slate-100">
                        {project.threads.map(thread => (
                            <div key={thread.id} className="flex items-center gap-1">
                                <button
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
                                </button>
                                
                                {/* Thread Actions */}
                                {thread.status === 'open' ? (
                                    <button 
                                        onClick={() => handleCloseThread(thread.id)}
                                        disabled={isUpdating}
                                        className="p-1 text-red-500 hover:bg-red-100 rounded-full"
                                        title="Close Thread"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => handleReopenThread(thread.id)}
                                            disabled={isUpdating}
                                            className="p-1 text-emerald-500 hover:bg-emerald-100 rounded-full"
                                            title="Reopen Thread"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleThreadDelete(thread.id)}
                                            disabled={isUpdating}
                                            className="p-1 text-red-500 hover:bg-red-100 rounded-full"
                                            title="Delete Thread"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    {/* Active Thread Title */}
                    {activeThread && (
                        <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <h3 className="font-bold text-slate-900 text-lg">{activeThread.title}</h3>
                            {activeThread.status === 'closed' && (
                                <p className="text-sm text-red-600 mt-1">This thread is closed. Reopen to send messages.</p>
                            )}
                        </div>
                    )}
                    
                    {/* Message List */}
                    <div className="h-80 overflow-y-auto space-y-4 p-2 flex flex-col">
                        {activeThread?.messages.length ? (
                        activeThread.messages.map(message => {
                            const isClient = (message.profiles as any)?.role === 'client';
                            const senderName = message.profiles?.full_name || 'Admin';

                            return (
                                <div key={message.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-xl text-sm ${isClient ? 'bg-slate-100 text-slate-800 rounded-tl-none' : 'bg-indigo-600 text-white rounded-br-none'}`}>
                                        <div className={`text-xs mb-1 ${isClient ? 'text-slate-500' : 'text-indigo-200'} flex justify-between items-center`}>
                                            <span>{senderName}</span>
                                            <span className="text-xs text-slate-400 ml-2">{new Date(message.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        {message.body}
                                        <button 
                                            onClick={() => handleMessageDelete(message.id)}
                                            disabled={isUpdating}
                                            className={`mt-1 text-red-300 hover:text-red-100 text-xs float-right ${isClient ? 'text-red-300' : 'text-red-100'}`}
                                            title="Delete Message"
                                        >
                                            <Trash2 className="w-3 h-3 inline" />
                                        </button>
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
                            placeholder="Send a message to the client..."
                            rows={2}
                            className="flex-1 p-3 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-500 outline-none"
                            />
                            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                            <Send className="w-5 h-5" />
                            </button>
                        </form>
                    ) : (
                        <div className="mt-4 p-3 bg-slate-100 text-slate-600 rounded-lg text-sm text-center">
                            This thread is closed. Reopen it to send messages.
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
                    </h2>
                    
                    {/* Deposit Application */}
                    <div className="p-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-bold text-sm text-blue-800 mb-2">Apply Deposit to Milestone</h3>
                        <form onSubmit={handleApplyDepositToMilestone} className="space-y-3">
                            <select
                                value={selectedDepositId}
                                onChange={(e) => setSelectedDepositId(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                required
                                disabled={isUpdating || deposits.filter(d => d.status === 'paid' && !d.applied_to_invoice_id).length === 0}
                            >
                                <option value="">-- Select Unapplied Deposit --</option>
                                {deposits.filter(d => d.status === 'paid' && !d.applied_to_invoice_id).map(deposit => (
                                    <option key={deposit.id} value={deposit.id}>
                                        ${(deposit.amount_cents / 100).toFixed(2)} - {format(new Date(deposit.created_at), 'MMM dd')}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={selectedMilestoneId}
                                onChange={(e) => setSelectedMilestoneId(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                required
                                disabled={isUpdating || project.milestones.filter(m => m.status === 'pending').length === 0}
                            >
                                <option value="">-- Select Pending Milestone --</option>
                                {project.milestones.filter(m => m.status === 'pending').map(milestone => (
                                    <option key={milestone.id} value={milestone.id}>
                                        {milestone.order_index}. {milestone.name} (${(milestone.amount_cents / 100).toFixed(2)})
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={isUpdating || !selectedDepositId || !selectedMilestoneId}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                                Apply Deposit
                            </button>
                        </form>
                    </div>
                    
                    {/* Milestone List */}
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
                                        {milestone.status === 'pending' && (
                                            <button 
                                                onClick={() => handleInvoiceMilestone(milestone)}
                                                disabled={isUpdating}
                                                className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1"
                                            >
                                                <Send className="w-3 h-3" /> Invoice
                                            </button>
                                        )}
                                        {milestone.stripe_invoice_id && milestone.status !== 'paid' && (
                                            <a 
                                                href={`https://dashboard.stripe.com/invoices/${milestone.stripe_invoice_id}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-red-600 hover:text-red-800 text-xs font-semibold flex items-center gap-1"
                                            >
                                                <ExternalLink className="w-3 h-3" /> View
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center p-8 bg-slate-50 rounded-lg text-slate-500">No payment milestones defined.</div>
                        )}
                    </div>
                    
                    <h3 className="font-bold text-sm mb-2 border-t border-slate-100 pt-4">Add New Milestone</h3>
                    <form onSubmit={handleAddMilestone} className="space-y-3">
                        <input
                            type="text"
                            value={newMilestoneName}
                            onChange={(e) => setNewMilestoneName(e.target.value)}
                            placeholder="Milestone Name (e.g., Design Approval)"
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            required
                            disabled={isUpdating}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                            <input
                                type="number"
                                value={newMilestoneAmount}
                                onChange={(e) => setNewMilestoneAmount(parseFloat(e.target.value) || '')}
                                placeholder="Amount"
                                className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                required
                                min="0.01"
                                step="0.01"
                                disabled={isUpdating}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isUpdating || !newMilestoneName || !newMilestoneAmount}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Add Milestone
                        </button>
                    </form>
                </div>
            )}
            
            {/* Files Tab */}
            {activeTab === 'files' && (
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
                                <p className="text-xs text-slate-500">Uploaded by: {file.profiles?.full_name || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleFileDownload(file.storage_path, file.file_name)}
                                    className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleFileDelete(file.id, file.storage_path)}
                                    disabled={isUpdating}
                                    className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1 disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
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
    </AdminLayout>
  );
};

export default AdminProjectDetail;