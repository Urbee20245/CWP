"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'; // Added Link import
import AdminLayout from '../components/AdminLayout';
import { Bot, Loader2, AlertTriangle, Save, Send, Edit, Mail, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';
import EmailEditor from '../components/EmailEditor';

interface Client {
    id: string;
    business_name: string;
    billing_email: string;
    full_name: string;
}

const TONES = [
    'Professional',
    'Friendly',
    'Firm',
    'Informational',
];

const AdminEmailDraft: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    // Get parameters from URL
    const clientId = searchParams.get('clientId');
    const clientEmail = searchParams.get('clientEmail');
    const clientName = searchParams.get('clientName');
    const clientFullName = searchParams.get('clientFullName');

    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [sendResult, setSendResult] = useState<'idle' | 'success' | 'failed'>('idle');
    
    // Generator Form State (Simplified)
    const [tone, setTone] = useState(TONES[0]);
    const [keyPoints, setKeyPoints] = useState('');
    const [callToAction, setCallToAction] = useState('');
    const [additionalNotes, setAdditionalNotes] = useState('');
    
    // Output State
    const [currentSubject, setCurrentSubject] = useState('');
    const [currentBody, setCurrentBody] = useState('');
    const [isEditing, setIsEditing] = useState(true);

    const fetchClientDetails = useCallback(async () => {
        if (!clientId) {
            setGenerationError('Client ID is missing from the URL.');
            setIsLoading(false);
            return;
        }
        
        // Fetch full client details for confirmation
        const { data: clientData, error } = await supabase
            .from('clients')
            .select(`
                id, business_name, billing_email,
                profiles (full_name)
            `)
            .eq('id', clientId)
            .single();

        if (error || !clientData) {
            setGenerationError('Failed to load client details.');
            setIsLoading(false);
            return;
        }
        
        const profile = (clientData as any).profiles;
        
        setClient({
            id: clientData.id,
            business_name: clientData.business_name,
            billing_email: clientData.billing_email || profile?.email || clientEmail || 'N/A',
            full_name: profile?.full_name || clientFullName || 'Client',
        });
        
        setIsLoading(false);
    }, [clientId, clientEmail, clientFullName]);

    useEffect(() => {
        fetchClientDetails();
    }, [fetchClientDetails]);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!client) return;
        
        setIsGenerating(true);
        setGenerationError(null);
        setSendResult('idle');
        
        const inputs = {
            clientName: client.business_name,
            clientEmail: client.billing_email,
            emailType: 'Custom One-Off Email',
            tone,
            keyPoints,
            callToAction,
            additionalNotes,
        };

        try {
            const result = await AdminService.generateEmail('Custom Email', inputs);
            setCurrentSubject(result.subject);
            setCurrentBody(result.body);
            setIsEditing(true);
        } catch (e: any) {
            setGenerationError(e.message || 'AI generation failed.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSendEmail = async () => {
        if (!client || !currentBody || !currentSubject || !user) return;
        
        if (!window.confirm(`Are you sure you want to send this email to ${client.billing_email}?`)) return;
        
        setIsSending(true);
        setSendResult('idle');
        setGenerationError(null);
        
        try {
            // 1. Send email via secure Edge Function
            await AdminService.sendEmail(
                client.billing_email,
                currentSubject,
                currentBody, // Sending Markdown body
                client.id,
                user.id
            );
            
            // 2. Log the email status in email_logs table
            const logData = {
                client_id: client.id,
                to_email: client.billing_email,
                subject: currentSubject,
                body: currentBody,
                status: 'sent',
                sent_by: user.id,
            };
            
            await supabase.from('email_logs').insert(logData);
            
            setSendResult('success');
            
            // Redirect back to client detail page after success
            setTimeout(() => {
                navigate(`/admin/clients/${client.id}`);
            }, 2000);
            
        } catch (e: any) {
            setSendResult('failed');
            setGenerationError(e.message || 'Failed to send email. Check SMTP settings.');
        } finally {
            setIsSending(false);
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
    
    if (generationError && !client) {
        return (
            <AdminLayout>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                    <h1 className="text-3xl font-bold text-red-500">Error Loading Client</h1>
                    <p className="text-slate-500 mt-4">{generationError}</p>
                    <button 
                        onClick={() => navigate('/admin/clients')}
                        className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Client List
                    </button>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Link to={`/admin/clients/${client?.id}`} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
                    ← Back to {client?.business_name} Detail
                </Link>
                
                <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                    <Mail className="w-7 h-7 text-emerald-600" /> Draft Email to {client?.business_name}
                </h1>
                <p className="text-slate-500 mb-8">Recipient: {client?.billing_email}</p>
                
                {sendResult === 'success' && (
                    <div className="p-4 mb-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Email successfully sent! Redirecting...
                    </div>
                )}
                {sendResult === 'failed' && (
                    <div className="p-4 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Send failed: {generationError}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: AI Assistant */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-600" /> AI Assistant
                            </h2>
                            <form onSubmit={handleGenerate} className="space-y-4">
                                
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
                                    disabled={isGenerating || !keyPoints}
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
                                            Generate Email Draft
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                    
                    {/* Right Column: Email Editor */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <Edit className="w-5 h-5 text-purple-600" /> Draft & Send
                            </h2>
                            
                            <EmailEditor
                                subject={currentSubject}
                                body={currentBody}
                                isEditing={isEditing}
                                onSubjectChange={setCurrentSubject}
                                onBodyChange={setCurrentBody}
                                disabled={isSending}
                            />
                            
                            <div className="mt-4 flex justify-between items-center pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setIsEditing(p => !p)}
                                    disabled={isSending || !currentBody}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Edit className="w-4 h-4" /> {isEditing ? 'Lock Editing' : 'Edit Content'}
                                </button>
                                
                                <button
                                    onClick={handleSendEmail}
                                    disabled={isSending || !currentSubject || !currentBody}
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {isSending ? 'Sending...' : 'Send Email Now'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminEmailDraft;