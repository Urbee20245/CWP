"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Briefcase, CheckCircle2, MessageSquare, FileText, Upload, Download, Send, ArrowLeft } from 'lucide-react';
import ClientLayout from '@/components/ClientLayout';
import { useAuth } from '@/hooks/useAuth';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  progress_percent: number;
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

const ClientProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchProjectData = async () => {
    if (!id) return;
    setIsLoading(true);
    
    // Fetch project details, tasks, messages, and files
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, title, description, status, progress_percent,
        tasks (id, title, status, due_date),
        messages (id, body, created_at, sender_profile_id, profiles (full_name)),
        files (id, file_name, file_type, file_size, storage_path, created_at, profiles (full_name))
      `)
      .eq('id', id)
      .order('created_at', { foreignTable: 'messages', ascending: true })
      .order('due_date', { foreignTable: 'tasks', ascending: true })
      .single();

    if (error) {
      console.error('Error fetching project details:', error);
      setProject(null);
    } else {
      setProject(data as unknown as Project);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

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
      fetchProjectData();
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload || !project || !profile) return;

    setIsUploading(true);
    
    // 1. Get Client ID (needed for storage path RLS)
    const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_profile_id', profile.id)
        .single();

    if (clientError || !clientData) {
        console.error('Could not find client ID for profile:', clientError);
        alert('Authentication error: Could not determine client ownership.');
        setIsUploading(false);
        return;
    }
    const clientId = clientData.id;

    // 2. Upload file to storage
    const fileExtension = fileToUpload.name.split('.').pop();
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

    // 3. Insert file record into database
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

  const completedTasks = project?.tasks.filter(t => t.status === 'done').length || 0;
  const totalTasks = project?.tasks.length || 0;

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
          <h1 className="text-3xl font-bold text-red-500">Project Not Found or Access Denied</h1>
        </div>
      </ClientLayout>
    );
  }

  const getProgressColor = (percent: number) => {
    if (percent === 100) return 'bg-emerald-600';
    if (percent >= 75) return 'bg-indigo-600';
    if (percent >= 50) return 'bg-amber-600';
    return 'bg-red-600';
  };

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/client/dashboard" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
          ← Back to Projects
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <Briefcase className="w-7 h-7 text-indigo-600" />
          {project.title}
        </h1>
        <p className="text-slate-500 mb-8">{project.description}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Progress & Tasks */}
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

          {/* Right Column: Messages & Files */}
          <div className="lg:col-span-2 space-y-8">
            
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