"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { FileText, Bot, Loader2, AlertTriangle, Save, Share2, Edit, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';

interface Client {
    id: string;
    business_name: string;
    billing_email: string;
}

interface Document {
    id: string;
    client_id: string;
    project_id: string | null;
    document_type: string;
    content: string;
    version: number;
    is_client_visible: boolean;
    created_at: string;
    created_by: string;
}

const DOCUMENT_TYPES = [
    'Terms & Conditions',
    'Privacy Policy',
    'Website Disclaimer',
    'Service Agreement',
];

const PROJECT_TYPES = [
    'Website',
    'SaaS Application',
    'E-commerce Store',
    'Nonprofit',
    'Blog/Informational',
];

const DATA_COLLECTED_OPTIONS = [
    'Email Address',
    'Phone Number',
    'Payment Information (via Stripe/PayPal)',
    'Cookies/Tracking Data',
    'User Generated Content',
    'Location Data',
];

const AdminDocumentGenerator: React.FC = () => {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    
    // Generator Form State
    const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
    const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [jurisdiction, setJurisdiction] = useState('Georgia, USA');
    const [servicesProvided, setServicesProvided] = useState('');
    const [dataCollected, setDataCollected] = useState<string[]>([]);
    const [specialNotes, setSpecialNotes] = useState('');
    
    // Output State
    const [currentDocumentContent, setCurrentDocumentContent] = useState('');
    const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
    const [currentDocumentVersion, setCurrentDocumentVersion] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

    const fetchClientsAndDocuments = useCallback(async () => {
        setIsLoading(true);
        
        // Fetch Clients
        const { data: clientsData, error: clientsError } = await supabase
            .from('clients')
            .select('id, business_name, billing_email')
            .order('business_name', { ascending: true });

        if (clientsError) {
            console.error('Error fetching clients:', clientsError);
            setIsLoading(false);
            return;
        }
        setClients(clientsData as Client[]);
        
        // Fetch Documents
        const { data: docsData, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (docsError) {
            console.error('Error fetching documents:', docsError);
        } else {
            setDocuments(docsData as Document[]);
        }

        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchClientsAndDocuments();
    }, [fetchClientsAndDocuments]);
    
    useEffect(() => {
        if (selectedClient) {
            setContactEmail(selectedClient.billing_email || '');
        }
    }, [selectedClient]);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) {
            setGenerationError('Please select a client first.');
            return;
        }
        
        setIsGenerating(true);
        setGenerationError(null);
        setCurrentDocumentContent('');
        
        const inputs = {
            clientName: selectedClient.business_name,
            websiteUrl,
            contactEmail,
            jurisdiction,
            projectType,
            servicesProvided: servicesProvided.split(',').map(s => s.trim()).filter(s => s),
            dataCollected,
            specialNotes,
        };

        try {
            const result = await AdminService.generateDocument(docType, inputs);
            setCurrentDocumentContent(result.content);
            setCurrentDocumentId(null); // New document
            setCurrentDocumentVersion(1);
            setIsEditing(true);
        } catch (e: any) {
            setGenerationError(e.message || 'AI generation failed.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSaveDocument = async () => {
        if (!selectedClient || !currentDocumentContent) return;
        setIsSaving(true);
        
        const newVersion = currentDocumentId ? currentDocumentVersion + 1 : 1;
        
        const documentData = {
            client_id: selectedClient.id,
            document_type: docType,
            content: currentDocumentContent,
            version: newVersion,
            created_by: user?.id,
            // project_id is optional, skipping for now
        };
        
        try {
            let error;
            let data;
            
            if (currentDocumentId) {
                // Update existing document (new version)
                const result = await supabase
                    .from('documents')
                    .update(documentData)
                    .eq('id', currentDocumentId)
                    .select()
                    .single();
                error = result.error;
                data = result.data;
            } else {
                // Insert new document
                const result = await supabase
                    .from('documents')
                    .insert(documentData)
                    .select()
                    .single();
                error = result.error;
                data = result.data;
            }
            
            if (error) throw error;
            
            setCurrentDocumentId(data.id);
            setCurrentDocumentVersion(data.version);
            setIsEditing(false);
            alert(`Document saved successfully! Version ${data.version}.`);
            fetchClientsAndDocuments(); // Refresh list
            
        } catch (e: any) {
            console.error('Error saving document:', e);
            alert('Failed to save document.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleLoadDocument = (doc: Document) => {
        setSelectedClient(clients.find(c => c.id === doc.client_id) || null);
        setDocType(doc.document_type);
        setCurrentDocumentContent(doc.content);
        setCurrentDocumentId(doc.id);
        setCurrentDocumentVersion(doc.version);
        setIsEditing(true);
        setGenerationError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const handleShareToggle = async (doc: Document) => {
        if (!window.confirm(`Are you sure you want to ${doc.is_client_visible ? 'UNSHARE' : 'SHARE'} this document with the client?`)) return;
        
        const { error } = await supabase
            .from('documents')
            .update({ is_client_visible: !doc.is_client_visible })
            .eq('id', doc.id);
            
        if (error) {
            alert('Failed to update sharing status.');
        } else {
            fetchClientsAndDocuments();
        }
    };
    
    const handleExport = (content: string, type: 'pdf' | 'html' | 'text') => {
        const filename = `${selectedClient?.business_name || 'Draft'}-${docType.replace(/\s/g, '_')}-v${currentDocumentVersion}.${type}`;
        
        if (type === 'text') {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            alert(`Export to ${type.toUpperCase()} is a premium feature. Exporting as plain text for now.`);
            handleExport(content, 'text');
        }
    };
    
    const renderDocumentContent = (content: string) => {
        // Simple markdown to HTML conversion for display
        let html = content;
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        html = html.replace(/## (.*)/g, '<h2>$1</h2>'); // H2
        html = html.replace(/### (.*)/g, '<h3>$1</h3>'); // H3
        html = html.replace(/\n/g, '<br/>'); // Newlines
        return <div dangerouslySetInnerHTML={{ __html: html }} className="prose max-w-none text-sm text-slate-700" />;
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Bot className="w-7 h-7 text-indigo-600" /> AI Document Generator
                </h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Generator Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4">
                                Document Inputs
                            </h2>
                            <form onSubmit={handleGenerate} className="space-y-4">
                                
                                {/* Client Selector */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Select Client *</label>
                                    <select
                                        value={selectedClient?.id || ''}
                                        onChange={(e) => setSelectedClient(clients.find(c => c.id === e.target.value) || null)}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                        disabled={isGenerating}
                                    >
                                        <option value="">-- Select Client --</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>{client.business_name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Document Type */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Document Type *</label>
                                    <select
                                        value={docType}
                                        onChange={(e) => setDocType(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                        disabled={isGenerating}
                                    >
                                        {DOCUMENT_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Core Details */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Website URL</label>
                                    <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="w-full p-2 border border-slate-300 rounded-lg text-sm" disabled={isGenerating} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Contact Email</label>
                                    <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="legal@example.com" className="w-full p-2 border border-slate-300 rounded-lg text-sm" disabled={isGenerating} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Jurisdiction</label>
                                    <input type="text" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="State, Country" className="w-full p-2 border border-slate-300 rounded-lg text-sm" disabled={isGenerating} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Project Type</label>
                                    <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" disabled={isGenerating}>
                                        {PROJECT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                    </select>
                                </div>
                                
                                {/* Services Provided */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Services Provided (Comma Separated)</label>
                                    <textarea value={servicesProvided} onChange={(e) => setServicesProvided(e.target.value)} placeholder="Web Design, SEO, AI Chatbot Integration" rows={2} className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none" disabled={isGenerating} />
                                </div>
                                
                                {/* Data Collected */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Data Collected</label>
                                    <div className="space-y-1">
                                        {DATA_COLLECTED_OPTIONS.map(option => (
                                            <label key={option} className="flex items-center text-sm text-slate-600">
                                                <input 
                                                    type="checkbox" 
                                                    checked={dataCollected.includes(option)}
                                                    onChange={() => setDataCollected(prev => prev.includes(option) ? prev.filter(d => d !== option) : [...prev, option])}
                                                    className="mr-2 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    disabled={isGenerating}
                                                />
                                                {option}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Special Notes */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Special Notes for AI</label>
                                    <textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} placeholder="e.g., Must mention no refunds after 30 days." rows={2} className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none" disabled={isGenerating} />
                                </div>

                                {generationError && (
                                    <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {generationError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isGenerating || !selectedClient || !websiteUrl || !contactEmail}
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
                                            Generate Document
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                    
                    {/* Right Column: Document Output & History */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Document Output */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <Edit className="w-5 h-5 text-purple-600" /> Document Draft 
                                {currentDocumentId && <span className="text-sm text-slate-500 ml-2">v{currentDocumentVersion}</span>}
                            </h2>
                            
                            {currentDocumentContent ? (
                                <>
                                    <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <p className="font-bold">LEGAL DISCLAIMER: This is an AI-generated draft. It MUST be reviewed by a licensed attorney before use.</p>
                                    </div>
                                    
                                    <textarea
                                        value={currentDocumentContent}
                                        onChange={(e) => setCurrentDocumentContent(e.target.value)}
                                        rows={20}
                                        className="w-full p-3 border border-slate-300 rounded-lg text-sm font-mono resize-none focus:border-indigo-500 outline-none"
                                        disabled={!isEditing}
                                    />
                                    
                                    <div className="mt-4 flex justify-between items-center">
                                        <button
                                            onClick={handleSaveDocument}
                                            disabled={isSaving || !selectedClient}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Save className="w-4 h-4" /> {currentDocumentId ? 'Save New Version' : 'Save Draft'}
                                        </button>
                                        
                                        <div className="flex gap-2">
                                            <button onClick={() => handleExport(currentDocumentContent, 'text')} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 flex items-center gap-2">
                                                <Download className="w-4 h-4" /> Export Text
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-12 bg-slate-50 rounded-lg text-slate-500">
                                    Fill out the form on the left and click 'Generate Document' to create a draft.
                                </div>
                            )}
                        </div>
                        
                        {/* Document History */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <FileText className="w-5 h-5 text-indigo-600" /> Document History
                            </h2>
                            
                            <div className="space-y-3">
                                {documents.length === 0 ? (
                                    <p className="text-slate-500 text-sm">No documents saved yet.</p>
                                ) : (
                                    documents.map(doc => {
                                        const client = clients.find(c => c.id === doc.client_id);
                                        return (
                                            <div key={doc.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-slate-900 truncate">{doc.document_type} (v{doc.version})</p>
                                                        <p className="text-xs text-slate-600 truncate">Client: {client?.business_name || 'Unknown'}</p>
                                                        <p className="text-xs text-slate-500 mt-1">Created: {format(new Date(doc.created_at), 'MMM dd, yyyy')}</p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${doc.is_client_visible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                                            {doc.is_client_visible ? 'Shared' : 'Internal'}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => handleLoadDocument(doc)}
                                                                className="text-indigo-600 hover:text-indigo-800 text-sm"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleShareToggle(doc)}
                                                                className={`text-sm ${doc.is_client_visible ? 'text-red-500 hover:text-red-700' : 'text-emerald-500 hover:text-emerald-700'}`}
                                                            >
                                                                <Share2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
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
                                                    {expandedDocId === doc.id ? 'Hide Content' : 'Preview Content'}
                                                    {expandedDocId === doc.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>
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

export default AdminDocumentGenerator;