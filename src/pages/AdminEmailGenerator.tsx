"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { FileText, Bot, Loader2, AlertTriangle, Save, Send, Edit, Trash2, CheckCircle2, MessageSquare, Clock, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import EmailEditor from '../components/EmailEditor'; // Import the new editor

interface Client {
    id: string;
    business_name: string;
    billing_email: string;
}

interface Project {
    id: string;
    title: string;
    service_status: 'active' | 'paused' | 'onboarding' | 'completed';
}

interface AdminEmail {
    id: string;
    client_id: string;
    project_id: string | null;
    subject: string;
    body: string;
    email_type: string;
    tone: string;
    status: 'draft' | 'sent';
    created_by: string;
    sent_at: string | null;
    created_at: string;
}

const EMAIL_TYPES = [
    'Project Update',
    'Invoice / Billing Notice',
    'Service Paused Notification',
    'Service Resumed Notification',
    'Onboarding / Welcome Email',
    'Custom Email',
];

const TONES = [
    'Professional',
    'Friendly',
    'Firm',
    'Informational',
];

const AdminEmailGenerator: React.FC = () => {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [emails, setEmails] = useState<AdminEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [sendResult, setSendResult] = useState<'idle' | 'success' | 'failed'>('idle');
    
    // Generator Form State
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [emailType, setEmailType] = useState(EMAIL_TYPES[0]);
    const [tone, setTone] = useState(TONES[0]);
    const [keyPoints, setKeyPoints] = useState('');
    const [callToAction, setCallToAction] = useState('');
    const [additionalNotes, setAdditionalNotes] = useState('');
    
    // Output State
    const [currentSubject, setCurrentSubject] = useState('');
    const [currentBody, setCurrentBody] = useState('');
    const [currentEmailId, setCurrentEmailId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const fetchClientsProjectsAndEmails = useCallback(async () => {
        setIsLoading(true);
        
        // Fetch Clients
        const { data: clientsData } = await supabase
            .from('clients')
            .select('id, business_name, billing_email')
            .order('business_name', { ascending: true });
        setClients(clientsData as Client[] || []);
        
        // Fetch Projects
        const { data: projectsData } = await supabase
            .from('projects')
            .select('id, title, service_status')
            .order('title', { ascending: true });
        setProjects(projectsData as Project[] || []);
        
        // Fetch Emails
        const { data: emailsData } = await supabase
            .from('admin_emails')
            .select('*')
            .order('created_at', { ascending: false });
        setEmails(emailsData as AdminEmail[] || []);

        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchClientsProjectsAndEmails();
    }, [fetchClientsProjectsAndEmails]);
    
    const selectedClient = clients.find(c => c.id === selectedClientId);
    const selectedProject = projects.find(p => p.id === selectedProjectId);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) {
            setGenerationError('Please select a client first.');
            return;
        }
        
        setIsGenerating(true);
        setGenerationError(null);
        setSendResult('idle');
        
        const inputs = {
            clientName: selectedClient.business_name,
            clientEmail: selectedClient.billing_email,
            projectTitle: selectedProject?.title,
            projectStatus: selectedProject?.service_status,
            emailType,
            tone,
            keyPoints,
            callToAction,
            additionalNotes,
        };

        try {
            const result = await AdminService.generateEmail(emailType, inputs);
            setCurrentSubject(result.subject);
            setCurrentBody(result.body);
            setCurrentEmailId(null); // New email
            setIsEditing(true);
        } catch (e: any) {
            setGenerationError(e.message || 'AI generation failed.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSaveDraft = async () => {
        if (!selectedClient || !currentBody) return;
        setIsSaving(true);
        
        const emailData = {
            client_id: selectedClient.id,
            project_id: selectedProjectId || null,
            subject: currentSubject,
            body: currentBody,
            email_type: emailType,
            tone: tone,
            status: 'draft',
            created_by: user?.id,
        };
        
        try {
            const { data, error } = await supabase
                .from('admin_emails')
                .insert(emailData)
                .select()
                .single();
            
            if (error) throw error;
            
            setCurrentEmailId(data.id);
            setIsEditing(false);
            alert(`Email draft saved successfully!`);
            fetchClientsProjectsAndEmails(); // Refresh list
            
        } catch (e: any) {
            console.error('Error saving email draft:', e);
            alert('Failed to save email draft.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSendEmail = async () => {
        if (!selectedClient || !currentBody || !currentSubject || !user) return;
        
        if (!window.confirm(`Are you sure you want to send this email to ${selectedClient.billing_email}?`)) return;
        
        setIsSending(true);
        setSendResult('idle');
        setGenerationError(null);
        
        try {
            // 1. Send email via secure Edge Function (AdminService handles Markdown to HTML conversion)
            await AdminService.sendEmail(
                selectedClient.billing_email,
                currentSubject,
                currentBody, // Sending Markdown body
                selectedClient.id,
                user.id
            );
            
            // 2. Update/Log the email status in admin_emails table
            const logData = {
                client_id: selectedClient.id,
                to_email: selectedClient.billing_email,
                subject: currentSubject,
                body: currentBody,
                status: 'sent',
                sent_by: user.id,
            };
            
            await supabase.from('email_logs').insert(logData);
            
            // 3. Update draft status if it was a draft
            if (currentEmailId) {
                await supabase.from('admin_emails').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', currentEmailId);
            }
            
            setSendResult('success');
            alert('Email sent successfully!');
            fetchClientsProjectsAndEmails();
            
        } catch (e: any) {
            setSendResult('failed');
            setGenerationError(e.message || 'Failed to send email. Check SMTP settings.');
        } finally {
            setIsSending(false);
        }
    };
    
    const handleLoadEmail = (email: AdminEmail) => {
        setSelectedClientId(email.client_id);
        setSelectedProjectId(email.project_id || '');
        setEmailType(email.email_type);
        setTone(email.tone);
        setCurrentSubject(email.subject);
        setCurrentBody(email.body);
        setCurrentEmailId(email.id);
        setIsEditing(true);
        setGenerationError(null);
        setSendResult('idle');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const getEmailStatusColor = (status: string) => {
        switch (status) {
            case 'sent': return 'bg-emerald-100 text-emerald-800';
            case 'draft': return 'bg-amber-100 text-amber-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Mail className="w-7 h-7 text-indigo-600" /> AI Email Generator
                </h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Generator Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4">
                                Email Context
                            </h2>
                            <form onSubmit={handleGenerate} className="space-y-4">
                                
                                {/* Client Selector */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Select Client *</label>
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                        disabled={isGenerating}
                                    >
                                        <option value="">-- Select Client --</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>{client.business_name}</option>
                                        ))}
                                    </select>
                                    {selectedClient && (
                                        <p className="text-xs text-slate-500 mt-1">To: {selectedClient.billing_email}</p>
                                    )}
                                </div>
                                
                                {/* Project Selector */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Select Project (Optional)</label>
                                    <select
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        disabled={isGenerating}
                                    >
                                        <option value="">-- General Client Email --</option>
                                        {projects.filter(p => p.service_status !== 'completed').map(project => (
                                            <option key={project.id} value={project.id}>{project.title} ({project.service_status})</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Email Type & Tone */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Email Type *</label>
                                        <select
                                            value={emailType}
                                            onChange={(e) => setEmailType(e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                            required
                                            disabled={isGenerating}
                                        >
                                            {EMAIL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Tone *</label>
                                        <select
                                            value={tone}
                                            onChange={(e) => setTone(e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                            required
                                            disabled={isGenerating}
                                        >
                                            {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>
                                
                                {/* Key Points */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Key Points to Include (Required)</label>
                                    <textarea 
                                        value={keyPoints} 
                                        onChange={(e) => setKeyPoints(e.target.value)} 
                                        placeholder="e.g., The design mockups are ready for review. We need feedback by Friday." 
                                        rows={3} 
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none" 
                                        required
                                        disabled={isGenerating} 
                                    />
                                </div>
                                
                                {/* Call to Action */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Call-to-Action (Optional)</label>
                                    <input 
                                        type="text" 
                                        value={callToAction} 
                                        onChange={(e) => setCallToAction(e.target.value)} 
                                        placeholder="e.g., Click here to schedule a call." 
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm" 
                                        disabled={isGenerating} 
                                    />
                                </div>
                                
                                {/* Additional Notes */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Additional Notes for AI (Optional)</label>
                                    <textarea 
                                        value={additionalNotes} 
                                        onChange={(e) => setAdditionalNotes(e.target.value)} 
                                        placeholder="e.g., Keep it under 5 sentences." 
                                        rows={2} 
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none" 
                                        disabled={isGenerating} 
                                    />
                                </div>

                                {generationError && (
                                    <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {generationError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isGenerating || !selectedClient || !keyPoints}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Generating Draft...
                                        </>
                                    ) : (
                                        <>
                                            <Bot className="w-5 h-5" />
                                            Generate Email
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                    
                    {/* Right Column: Email Output & History */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Email Output */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <Edit className="w-5 h-5 text-purple-600" /> Email Draft
                                {currentEmailId && <span className="text-sm text-slate-500 ml-2"> (Draft ID: {currentEmailId.substring(0, 8)})</span>}
                            </h2>
                            
                            {currentBody ? (
                                <>
                                    <div className="p-3 mb-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800 flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <p className="font-bold">Review Required: AI-generated content must be checked before sending.</p>
                                    </div>
                                    
                                    <EmailEditor
                                        subject={currentSubject}
                                        body={currentBody}
                                        isEditing={isEditing}
                                        onSubjectChange={setCurrentSubject}
                                        onBodyChange={setCurrentBody}
                                        disabled={isSending}
                                    />
                                    
                                    {sendResult === 'success' && (
                                        <div className="p-3 mt-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Email successfully sent!
                                        </div>
                                    )}
                                    {sendResult === 'failed' && (
                                        <div className="p-3 mt-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Send failed: {generationError}
                                        </div>
                                    )}
                                    
                                    <div className="mt-4 flex justify-between items-center pt-4 border-t border-slate-100">
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleSaveDraft}
                                                disabled={isSaving || isSending || !selectedClient}
                                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Draft'}
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(p => !p)}
                                                disabled={isSending}
                                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                <Edit className="w-4 h-4" /> {isEditing ? 'Lock Editing' : 'Edit Content'}
                                            </button>
                                        </div>
                                        
                                        <button
                                            onClick={handleSendEmail}
                                            disabled={isSending || !selectedClient || !currentSubject || !currentBody}
                                            className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            {isSending ? 'Sending...' : 'Send Email'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-12 bg-slate-50 rounded-lg text-slate-500">
                                    Fill out the form on the left and click 'Generate Email' to create a draft.
                                </div>
                            )}
                        </div>
                        
                        {/* Email History */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <Clock className="w-5 h-5 text-indigo-600" /> Email History ({emails.length})
                            </h2>
                            
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {emails.length === 0 ? (
                                    <p className="text-slate-500 text-sm">No emails saved yet.</p>
                                ) : (
                                    emails.map(email => {
                                        const client = clients.find(c => c.id === email.client_id);
                                        return (
                                            <div key={email.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => handleLoadEmail(email)}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-slate-900 truncate">{email.subject}</p>
                                                        <p className="text-xs text-slate-600 truncate">To: {client?.business_name || 'Unknown Client'}</p>
                                                        <p className="text-xs text-slate-500 mt-1">Type: {email.email_type} | {format(new Date(email.created_at), 'MMM dd, HH:mm')}</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${getEmailStatusColor(email.status)}`}>
                                                        {email.status}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminEmailGenerator;