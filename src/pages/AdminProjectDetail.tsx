"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, CheckCircle2, MessageSquare, FileText, Upload, Trash2, Plus, ArrowLeft, Clock, AlertTriangle, Download, Send, DollarSign, ExternalLink, Pause, Play, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Profile } from '../types/auth';
import { calculateSlaMetrics, calculateSlaDueDate, SlaStatus, adjustSlaDueDate } from '../utils/sla';
import { format, differenceInDays, parseISO } from 'date-fns';
import { AdminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth'; // <-- New Import

interface Milestone {
  id: string;
  name: string;
  amount_cents: number;
  status: 'pending' | 'invoiced' | 'paid';
  order_index: number;
  stripe_invoice_id: string | null;
}

type ProjectServiceStatus = 'active' | 'paused' | 'awaiting_payment' | 'completed';

interface Thread {
    id: string;
    title: string;
    status: 'open' | 'closed' | 'archived';
    created_at: string;
    created_by: string;
    messages: Message[];
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'awaiting_deposit' | 'active' | 'paused' | 'completed';
  progress_percent: number;
  client_id: string;
  clients: { business_name: string };
  tasks: Task[];
  threads: Thread[]; // Changed from messages
  files: FileItem[];
  milestones: Milestone[]; 
  required_deposit_cents: number | null; 
  deposit_paid: boolean; 
  // SLA Fields
  sla_days: number | null;
  sla_start_date: string | null;
  sla_due_date: string | null;
  sla_status: SlaStatus;
  service_status: ProjectServiceStatus; 
  service_paused_at: string | null; 
  service_resumed_at: string | null; 
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
    internal_note: string | null;
    client_acknowledged: boolean;
    created_at: string;
}

const AdminProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      .order('created_at', { foreignTable: 'messages', ascending: true })
      .order('due_date', { foreignTable: 'tasks', ascending: true })
      .order('order_index', { foreignTable: 'milestones', ascending: true })
      .order('created_at', { foreignTable: 'project_threads', ascending: false })
      .single();

    if (error) {
      console.error('Error fetching project details:', error);
      setProject(null);
    } else {
      const projectData = data as unknown as Project;
      setProject(projectData);
      setNewProgress(projectData.progress_percent);
      setSlaDays(projectData.sla_days || '');
      setSlaStartDate(projectData.sla_start_date ? format(new Date(projectData.sla_start_date), 'yyyy-MM-dd') : '');
      setRequiredDeposit(projectData.required_deposit_cents ? projectData.required_deposit_cents / 100 : '');
      
      // Set active thread to the first open thread, or the first thread if none are open
      if (projectData.threads && projectData.threads.length > 0) {
          const openThread = projectData.threads.find(t => t.status === 'open');
          setActiveThreadId(openThread?.id || projectData.threads[0].id);
      }
      
      // Calculate SLA metrics immediately
      if (projectData.sla_days && projectData.sla_start_date && projectData.sla_due_date) {
        const metrics = calculateSlaMetrics(
          projectData.progress_percent,
          projectData.sla_days,
          projectData.sla_start_date,
          projectData.sla_due_date,
          projectData.sla_paused_at,
          projectData.sla_resume_offset_days
        );
        setSlaMetrics(metrics);
        // Update DB status if calculated status differs (optional auto-sync)
        if (metrics.slaStatus !== projectData.sla_status) {
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
          setPauseLogs(logsData as PauseLog[]);
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
  
  const handleUpdateDepositRequirement = async () => {
    if (!project) return;
    setIsUpdating(true);
    
    const depositCents = requiredDeposit ? Math.round(requiredDeposit as number * 100) : null;
    
    let newStatus = project.status;
    if (depositCents && depositCents > 0 && !project.deposit_paid) {
        newStatus = 'awaiting_deposit';
    } else if (project.deposit_paid && project.status === 'awaiting_deposit') {
        newStatus = 'active';
    } else if (!depositCents && project.status === 'awaiting_deposit') {
        newStatus = 'draft'; // If deposit requirement is removed
    }
    
    const { error } = await supabase
        .from('projects')
        .update({ 
            required_deposit_cents: depositCents,
            status: newStatus
        })
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
            `Required Deposit for Project: ${project.title}`,
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
  
  const handleUpdateProjectStatus = async (newStatus: Project['status']) => {
    if (!project) return;
    
    // Prevent starting if deposit is required but not paid
    if (newStatus === 'active' && project.required_deposit_cents && project.required_deposit_cents > 0 && !project.deposit_paid) {
        alert("Cannot set project to 'active'. Deposit is required but not yet paid.");
        return;
    }
    
    // Prevent 100% completion if milestones are unpaid
    if (newStatus === 'completed') {
        const unpaidMilestones = project.milestones.filter(m => m.status !== 'paid');
        if (unpaidMilestones.length > 0) {
            alert(`Cannot set project to 'completed'. ${unpaidMilestones.length} milestones are still unpaid.`);
            return;
        }
    }
    
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
    if (!project || !project.sla_due_date || !project.sla_start_date) return;
    setIsUpdating(true);
    
    const action = newStatus === 'paused' || newStatus === 'awaiting_payment' ? 'paused' : 'resumed';
    const now = new Date().toISOString();
    
    let updatePayload: Partial<Project> = { service_status: newStatus };
    let logAction: 'paused' | 'resumed' = 'paused';
    
    if (action === 'paused' && project.service_status !== 'paused' && project.service_status !== 'awaiting_payment') {
        // PAUSE LOGIC
        logAction = 'paused';
        updatePayload = {
            ...updatePayload,
            service_paused_at: now,
            sla_paused_at: now,
        };
    } else if (action === 'resumed' && (project.service_status === 'paused' || project.service_status === 'awaiting_payment')) {
        // RESUME LOGIC
        logAction = 'resumed';
        
        if (project.sla_paused_at) {
            const pausedTime = parseISO(project.sla_paused_at);
            const currentPauseDurationDays = differenceInDays(parseISO(now), pausedTime);
            const newOffsetDays = project.sla_resume_offset_days + currentPauseDurationDays;
            
            const newDueDate = adjustSlaDueDate(project.sla_due_date, currentPauseDurationDays);
            
            updatePayload = {
                ...updatePayload,
                service_resumed_at: now,
                sla_paused_at: null,
                sla_resume_offset_days: newOffsetDays,
                sla_due_date: newDueDate,
            };
            alert(`SLA adjusted by ${currentPauseDurationDays} days. New Due Date: ${format(parseISO(newDueDate), 'MMM dd, yyyy')}`);
        } else {
            updatePayload = {
                ...updatePayload,
                service_resumed_at: now,
                sla_paused_at: null,
            };
        }
    } else {
        // Status change without pause/resume action (e.g., active -> completed)
        logAction = newStatus === 'completed' ? 'resumed' : 'paused'; // Placeholder action for log
    }

    try {
        // 1. Update project status and SLA fields
        const { error: updateError } = await supabase
            .from('projects')
            .update(updatePayload)
            .eq('id', project.id);
            
        if (updateError) throw updateError;

        // 2. Log the action
        const { error: logError } = await supabase
            .from('service_pause_logs')
            .insert({
                client_id: project.client_id,
                project_id: project.id,
                action: logAction,
                internal_note: serviceActionNote,
            });
            
        if (logError) console.error('Error logging service action:', logError);
        
        // 3. Send notification (Mocked server-side call)
        // NOTE: In a real app, this would be an Edge Function call to send the email securely.
        // const clientEmail = (project.clients as any).billing_email || (project.clients as any).profiles.email;
        // await AdminService.sendServiceStatusNotification(clientEmail, project.clients.business_name, logAction, project.title);

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
          
          // Try to switch to the next open thread or the first thread
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
  
  const activeThread = project?.threads.find(t => t.id === activeThreadId);

  const completedTasks = project?.tasks.filter(t => t.status === 'done').length || 0;
  const totalTasks = project?.tasks.length || 0;
  
  const getSlaColor = (status: SlaStatus) => {
      switch (status) {
          case 'on_track': return 'bg-emerald-100 text-emerald-800';
          case 'at_risk': return 'bg-amber-100 text-amber-800';
          case 'breached': return 'bg-red-100 text-red-800';
          default: return 'bg-slate-100 text-slate-800';
      }
  };
  
  const getTaskStatusColor = (status: Task['status']) => {
      switch (status) {
          case 'done': return 'bg-emerald-100 text-emerald-800';
          case 'in_progress': return 'bg-indigo-100 text-indigo-800';
          case 'blocked': return 'bg-red-100 text-red-800';
          case 'todo':
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
  
  const getServiceStatusColor = (status: ProjectServiceStatus) => {
      switch (status) {
          case 'active': return 'bg-emerald-100 text-emerald-800';
          case 'paused': return 'bg-amber-100 text-amber-800';
          case 'awaiting_payment': return 'bg-red-100 text-red-800';
          case 'completed': return 'bg-blue-100 text-blue-800';
          default: return 'bg-slate-100 text-slate-800';
      }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </AdminLayout>
    );
  }

  if (!project) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-3xl font-bold text-red-500">Project Not Found</h1>
        </div>
      </AdminLayout>
    );
  }

  const isDepositRequired = project.required_deposit_cents && project.required_deposit_cents > 0;
  const isProjectActive = project.status === 'active';
  const isProjectCompleted = project.status === 'completed';

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to={`/admin/clients/${project.client_id}`} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
          ← Back to {project.clients.business_name}
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <Briefcase className="w-7 h-7 text-indigo-600" />
          {project.title}
        </h1>
        <p className="text-slate-500 mb-8">Client: {project.clients.business_name}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Progress, SLA & Tasks */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Service Control */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                    <Briefcase className="w-5 h-5 text-indigo-600" /> Service Control
                </h2>
                
                <div className="mb-4 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Current Service Status</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getServiceStatusColor(project.service_status)}`}>
                        {project.service_status.replace('_', ' ')}
                    </span>
                </div>
                
                <div className="space-y-3 mb-4">
                    <textarea
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-500 outline-none"
                        value={serviceActionNote}
                        onChange={(e) => setServiceActionNote(e.target.value)}
                        placeholder="Internal note for pause/resume action (optional)"
                        rows={2}
                        disabled={isUpdating}
                    />
                    <div className="flex gap-3 flex-wrap">
                        {project.service_status !== 'paused' && project.service_status !== 'awaiting_payment' ? (
                            <button 
                                onClick={() => handleUpdateServiceStatus('paused')}
                                disabled={isUpdating || project.service_status === 'completed'}
                                className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Pause className="w-4 h-4" /> Pause Work
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleUpdateServiceStatus('active')}
                                disabled={isUpdating}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Play className="w-4 h-4" /> Resume Work
                            </button>
                        )}
                        <button 
                            onClick={() => handleUpdateServiceStatus('awaiting_payment')}
                            disabled={isUpdating || project.service_status === 'completed'}
                            className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            Awaiting Payment
                        </button>
                    </div>
                </div>
                
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-t border-slate-100 pt-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" /> Service History
                </h3>
                <div className="max-h-40 overflow-y-auto space-y-2">
                    {pauseLogs && pauseLogs.length > 0 ? (
                        pauseLogs.map(log => (
                            <div key={log.id} className={`p-2 rounded-lg text-xs border ${log.action === 'paused' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold uppercase">{log.action}</span>
                                    <span className="text-slate-500">{new Date(log.created_at).toLocaleDateString()}</span>
                                </div>
                                {log.internal_note && <p className="text-slate-700 mt-1 italic">Note: {log.internal_note}</p>}
                                <div className="flex items-center gap-1 mt-1">
                                    <CheckCircle2 className={`w-3 h-3 ${log.client_acknowledged ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    <span className="text-slate-600">{log.client_acknowledged ? 'Client Acknowledged' : 'Awaiting Client Ack'}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-500">No service history recorded.</p>
                    )}
                </div>
            </div>
            
            {/* Project Status & Deposit Gate */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold mb-4">Project Status</h2>
                
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Current Status</label>
                    <select
                        value={project.status}
                        onChange={(e) => handleUpdateProjectStatus(e.target.value as Project['status'])}
                        className={`w-full p-2 border border-slate-300 rounded-lg text-sm font-bold ${getMilestoneStatusColor(project.status as any)}`}
                        disabled={isUpdating}
                    >
                        <option value="draft">Draft</option>
                        <option value="awaiting_deposit">Awaiting Deposit</option>
                        <option value="active">Active</option>
                        <option value="paused">On Hold</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                
                {isDepositRequired && (
                    <div className={`p-4 rounded-lg border ${project.deposit_paid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} mb-4`}>
                        <h3 className="font-bold text-sm flex items-center gap-2">
                            {project.deposit_paid ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                            Deposit Status
                        </h3>
                        <p className="text-lg font-bold mt-1">
                            {project.deposit_paid ? 'PAID' : 'AWAITING PAYMENT'}
                        </p>
                        <p className="text-xs mt-1 text-slate-600">
                            Required: ${project.required_deposit_cents ? (project.required_deposit_cents / 100).toFixed(2) : 'N/A'}
                        </p>
                        
                        {!project.deposit_paid && project.status === 'awaiting_deposit' && (
                            <button 
                                onClick={handleSendDepositInvoice}
                                disabled={isUpdating}
                                className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <DollarSign className="w-4 h-4" /> Send Deposit Invoice
                            </button>
                        )}
                    </div>
                )}
                
                {/* Progress Control */}
                <h2 className="text-xl font-bold mb-4 border-t border-slate-100 pt-4">Project Progress</h2>
                <div className="text-4xl font-bold text-indigo-600 mb-4">{project.progress_percent}%</div>
                
                <div className="w-full bg-slate-200 rounded-full h-3 mb-4">
                    <div 
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-500" 
                    style={{ width: `${project.progress_percent}%` }}
                    ></div>
                </div>

                <p className="text-sm text-slate-600 mb-4">{completedTasks}/{totalTasks} Tasks Completed</p>

                <div className="mt-4">
                    <label htmlFor="progress-slider" className="block text-sm font-medium mb-2">Update Progress (0-100)</label>
                    <input
                    id="progress-slider"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={newProgress}
                    onChange={(e) => setNewProgress(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer range-lg"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>0%</span>
                        <span>{newProgress}%</span>
                        <span>100%</span>
                    </div>
                    <button 
                    onClick={handleProgressUpdate}
                    disabled={isUpdating || !isProjectActive}
                    className="mt-4 w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                    {isUpdating ? 'Saving...' : 'Save Progress'}
                    </button>
                </div>
            </div>
            
            {/* SLA Control */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Clock className="w-5 h-5 text-red-600" /> SLA Timer
              </h2>
              
              {project.sla_due_date && slaMetrics ? (
                  <div className="mb-4 p-3 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Current Status</p>
                      <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${getSlaColor(slaMetrics.slaStatus)}`}>
                          {slaMetrics.slaStatus.replace('_', ' ')}
                      </span>
                      <p className="text-sm text-slate-600 mt-2">Due: {format(new Date(project.sla_due_date), 'MMM dd, yyyy')}</p>
                      <p className="text-sm text-slate-600">Expected Progress: {slaMetrics.expectedProgress}%</p>
                      <p className="text-sm text-slate-600">Days Remaining: {slaMetrics.daysRemaining}</p>
                      <p className="text-xs text-slate-500 mt-2">Paused Days Offset: {project.sla_resume_offset_days}</p>
                  </div>
              ) : (
                  <p className="text-sm text-slate-500 mb-4">SLA not configured.</p>
              )}

              <h3 className="font-bold text-sm mb-2">Set/Update SLA</h3>
              <div className="space-y-3">
                  <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">SLA Duration (Days)</label>
                      <input
                          type="number"
                          value={slaDays}
                          onChange={(e) => setSlaDays(parseInt(e.target.value) || '')}
                          min="1"
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
              </div>
              <button 
                onClick={handleSlaUpdate}
                disabled={isUpdating || !slaDays || !slaStartDate}
                className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isUpdating ? 'Saving SLA...' : 'Save SLA'}
              </button>
            </div>

            {/* Tasks List */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Tasks
              </h2>
              <div className="space-y-3 mb-4">
                {project.tasks.length > 0 ? (
                  project.tasks.map(task => (
                    <div key={task.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm text-slate-900">{task.title}</p>
                        {task.due_date && <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.due_date).toLocaleDateString()}</p>}
                      </div>
                      <select
                          value={task.status}
                          onChange={(e) => handleTaskStatusUpdate(task.id, e.target.value as Task['status'])}
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold border-none ${getTaskStatusColor(task.status)}`}
                          disabled={isUpdating}
                      >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                          <option value="blocked">Blocked</option>
                      </select>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No tasks defined.</p>
                )}
              </div>
              
              {/* Add New Task Form */}
              <form onSubmit={handleTaskCreation} className="space-y-3 pt-4 border-t border-slate-100">
                  <h3 className="font-bold text-sm text-slate-900">Add New Task</h3>
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
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isUpdating ? 'Adding...' : 'Add Task'}
                  </button>
              </form>
            </div>
          </div>

          {/* Right Column: Messages, Files & Milestones */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Milestones & Deposit Requirement */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                    <DollarSign className="w-5 h-5 text-purple-600" /> Project Milestones
                </h2>
                
                {/* Deposit Requirement Setting */}
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-sm mb-2">Set Deposit Requirement</h3>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                            <input
                                type="number"
                                value={requiredDeposit}
                                onChange={(e) => setRequiredDeposit(parseFloat(e.target.value) || '')}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                disabled={isUpdating}
                            />
                        </div>
                        <button 
                            onClick={handleUpdateDepositRequirement}
                            disabled={isUpdating}
                            className="py-2 px-4 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            Save Deposit
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Current Status: {project.deposit_paid ? 'Paid' : 'Unpaid'}
                    </p>
                </div>

                {/* Milestones List */}
                <div className="space-y-3 mb-6">
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
                                            <DollarSign className="w-4 h-4" /> Invoice
                                        </button>
                                    )}
                                    {milestone.stripe_invoice_id && (
                                        <a 
                                            href={`https://dashboard.stripe.com/invoices/${milestone.stripe_invoice_id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-slate-500 hover:text-indigo-600 text-xs flex items-center gap-1"
                                        >
                                            <ExternalLink className="w-3 h-3" /> Stripe
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-slate-500 text-sm">No milestones defined.</p>
                    )}
                </div>
                
                {/* Add New Milestone Form */}
                <form onSubmit={handleAddMilestone} className="space-y-3 pt-4 border-t border-slate-100">
                    <h3 className="font-bold text-sm text-slate-900">Add New Milestone</h3>
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
                            placeholder="Amount (USD)"
                            min="0.01"
                            step="0.01"
                            className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                            required
                            disabled={isUpdating}
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={isUpdating || !newMilestoneName || !newMilestoneAmount}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {isUpdating ? 'Adding...' : 'Add Milestone'}
                    </button>
                </form>
            </div>

            {/* Messages Thread */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <MessageSquare className="w-5 h-5 text-indigo-600" /> Project Threads
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
              
              {/* Active Thread Actions */}
              {activeThread && (
                  <div className="flex justify-between items-center mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <h3 className="font-bold text-slate-900 text-lg">{activeThread.title}</h3>
                      <div className="flex gap-2">
                          {activeThread.status === 'open' ? (
                              <button 
                                  onClick={() => handleCloseThread(activeThread.id)}
                                  disabled={isUpdating}
                                  className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                  <X className="w-3 h-3" /> Close Thread
                              </button>
                          ) : (
                              <button 
                                  onClick={() => handleReopenThread(activeThread.id)}
                                  disabled={isUpdating}
                                  className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-xs font-semibold hover:bg-emerald-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                  <Play className="w-3 h-3" /> Reopen Thread
                              </button>
                          )}
                      </div>
                  </div>
              )}
              
              {/* Message List */}
              <div className="h-80 overflow-y-auto space-y-4 p-2 flex flex-col">
                {activeThread?.messages.length ? (
                  activeThread.messages.map(message => (
                    <div key={message.id} className={`flex ${message.sender_profile_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-xl text-sm relative ${message.sender_profile_id === user?.id ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                            <div className={`text-xs mb-1 flex justify-between items-center ${message.sender_profile_id === user?.id ? 'text-indigo-200' : 'text-slate-500'}`}>
                                <span>{message.sender_profile_id === user?.id ? 'You' : message.profiles?.full_name || 'System User'} - {new Date(message.created_at).toLocaleTimeString()}</span>
                                {message.sender_profile_id === user?.id && (
                                    <button 
                                        onClick={() => handleMessageDelete(message.id)}
                                        disabled={isUpdating}
                                        className="text-red-300 hover:text-red-100 ml-3 transition-colors"
                                        title="Delete Message"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
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
                        Send
                      </button>
                  </form>
              ) : (
                  <div className="mt-4 p-3 bg-slate-100 text-slate-600 rounded-lg text-sm text-center">
                      This thread is closed. Reopen it above to send messages.
                  </div>
              )}
              
              {/* New Thread Form */}
              <form onSubmit={handleCreateThread} className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                  <input
                      type="text"
                      value={newThreadTitle}
                      onChange={(e) => setNewThreadTitle(e.target.value)}
                      placeholder="New Thread Title (e.g., Design Feedback)"
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
                      <div className="flex gap-2">
                        <button 
                            onClick={() => handleFileDownload(file.storage_path, file.file_name)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleFileDelete(file.id, file.storage_path)}
                            className="text-red-500 hover:text-red-700 text-sm"
                            disabled={isUpdating}
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
              
              {/* File Upload Form */}
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
    </AdminLayout>
  );
};

export default AdminProjectDetail;