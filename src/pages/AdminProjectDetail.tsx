"use client";

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Briefcase, CheckCircle2, MessageSquare, FileText, Upload, Trash2, Plus, ArrowLeft } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Profile } from '@/types/auth';

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
      setProject(data as unknown as Project);
      setNewProgress(data.progress_percent);
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

  const completedTasks = project?.tasks.filter(t => t.status === 'done').length || 0;
  const totalTasks = project?.tasks.length || 0;

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
          
          {/* Left Column: Progress & Tasks */}
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
              <button className="mt-6 w-full py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
                <Plus className="w-4 h-4 inline mr-2" /> Add New Task
              </button>
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
                        <button className="text-indigo-600 hover:text-indigo-800 text-sm">Download</button>
                        <button className="text-red-500 hover:text-red-700 text-sm"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No files uploaded yet.</p>
                )}
              </div>
              <button className="mt-6 w-full py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
                <Upload className="w-4 h-4 inline mr-2" /> Upload File
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminProjectDetail;