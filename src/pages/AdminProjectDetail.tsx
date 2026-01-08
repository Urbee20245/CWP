"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, CheckCircle2, MessageSquare, FileText, Upload, Trash2, Plus, ArrowLeft, Clock, AlertTriangle, Download, Send } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Profile } from '../types/auth';
import { calculateSlaMetrics, calculateSlaDueDate, SlaStatus } from '../utils/sla';
import { format } from 'date-fns';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  progress_percent: number;
  client_id: string;
  clients: { business_name: string };
  tasks: Task[];
  messages: Message[];
  files: FileItem[];
  // SLA Fields
  sla_days: number | null;
  sla_start_date: string | null;
  sla_due_date: string | null;
  sla_status: SlaStatus;
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

const AdminProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newProgress, setNewProgress] = useState(0);
  const [newMessage, setNewMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  // Task State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  
  // SLA State
  const [slaDays, setSlaDays] = useState<number | ''>('');
  const [slaStartDate, setSlaStartDate] = useState<string>('');
  const [slaMetrics, setSlaMetrics] = useState<ReturnType<typeof calculateSlaMetrics> | null>(null);

  const fetchProjectData = async () => {
    if (!id) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        clients (business_name),
        tasks (id, title, status, due_date),
        messages (id, body, created_at, sender_profile_id, profiles (full_name)),
        files (id, file_name, file_type, file_size, storage_path, created_at, profiles (full_name))
      `)
      .eq('id', id)
      .order('created_at', { foreignTable: 'messages', ascending: false })
      .order('due_date', { foreignTable: 'tasks', ascending: true })
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
      
      // Calculate SLA metrics immediately
      if (projectData.sla_days && projectData.sla_start_date && projectData.sla_due_date) {
        const metrics = calculateSlaMetrics(
          projectData.progress_percent,
          projectData.sla_days,
          projectData.sla_start_date,
          projectData.sla_due_date
        );
        setSlaMetrics(metrics);
        // Update DB status if calculated status differs (optional auto-sync)
        if (metrics.slaStatus !== projectData.sla_status) {
            await supabase.from('projects').update({ sla_status: metrics.slaStatus }).eq('id', id);
        }
      } else {
          setSlaMetrics(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const handleProgressUpdate = async () => {
    if (!project) return;
    setIsUpdating(true);
    
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
          sla_status: 'on_track' // Reset status on manual update
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
    if (!newMessage.trim() || !project) return;

    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        project_id: project.id,
        sender_profile_id: user.data.user.id,
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
  
  const handleTaskCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !project) return;
    
    setIsUpdating(true);
    
    const { error } = await supabase
        .from('tasks')
        .insert({
            project_id: project.id,
            title: newTaskTitle.trim(),
            due_date: newTaskDueDate || null,
            status: 'todo',
            created_by: (await supabase.auth.getUser()).data.user?.id,
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
    if (!fileToUpload || !project) return;

    setIsUploading(true);
    
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
        alert("User not authenticated.");
        setIsUploading(false);
        return;
    }
    
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
        uploader_profile_id: user.data.user.id,
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
            
            {/* Progress Control */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4">Project Progress</h2>
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
                  disabled={isUpdating}
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

          {/* Right Column: Messages & Files */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Messages Thread */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <MessageSquare className="w-5 h-5 text-indigo-600" /> Project Messages
              </h2>
              <div className="h-80 overflow-y-auto space-y-4 flex flex-col-reverse">
                {project.messages.length > 0 ? (
                  project.messages.map(message => (
                    <div key={message.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-slate-700">{message.profiles.full_name}</span>
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-800">{message.body}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500">Start the conversation!</div>
                )}
              </div>
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