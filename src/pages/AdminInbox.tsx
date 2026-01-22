"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Inbox, Send, Mail, RefreshCw, Archive, Eye, EyeOff, ArrowLeft, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

// Define types for emails
interface IncomingEmail {
    id: string;
    from_name: string;
    from_email: string;
    subject: string;
    body: string;
    status: 'unread' | 'read' | 'archived';
    received_at: string;
}

interface SentEmail {
    id: string;
    to_email: string;
    subject: string;
    body: string;
    status: 'sent' | 'failed';
    sent_at: string;
}

const AdminInbox: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
    const [incomingEmails, setIncomingEmails] = useState<IncomingEmail[]>([]);
    const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<IncomingEmail | SentEmail | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setSelectedEmail(null);

        if (activeTab === 'inbox') {
            const { data, error } = await supabase
                .from('incoming_emails')
                .select('*')
                .neq('status', 'archived')
                .order('received_at', { ascending: false });
            if (error) console.error('Error fetching inbox:', error);
            else setIncomingEmails(data as IncomingEmail[]);
        } else {
            const { data, error } = await supabase
                .from('email_logs')
                .select('id, to_email, subject, body, status, sent_at')
                .eq('status', 'sent')
                .order('sent_at', { ascending: false });
            if (error) console.error('Error fetching sent mail:', error);
            else setSentEmails(data as SentEmail[]);
        }
        setIsLoading(false);
    }, [activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSelectEmail = async (email: IncomingEmail | SentEmail) => {
        setSelectedEmail(email);
        if ('status' in email && email.status === 'unread') {
            const { error } = await supabase
                .from('incoming_emails')
                .update({ status: 'read' })
                .eq('id', email.id);
            if (!error) {
                setIncomingEmails(prev => prev.map(e => e.id === email.id ? { ...e, status: 'read' } : e));
            }
        }
    };

    const handleStatusChange = async (emailId: string, newStatus: IncomingEmail['status']) => {
        const { error } = await supabase
            .from('incoming_emails')
            .update({ status: newStatus })
            .eq('id', emailId);
        if (error) {
            alert(`Failed to update status: ${error.message}`);
        } else {
            fetchData();
        }
    };

    const EmailListItem: React.FC<{ email: IncomingEmail | SentEmail }> = ({ email }) => {
        const isIncoming = 'from_name' in email;
        const isSelected = selectedEmail?.id === email.id;
        const isUnread = isIncoming && email.status === 'unread';

        return (
            <div
                onClick={() => handleSelectEmail(email)}
                className={`p-3 border-l-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50 border-indigo-600' : isUnread ? 'bg-white border-blue-500' : 'bg-white border-transparent hover:bg-slate-50'
                }`}
            >
                <div className="flex justify-between items-start">
                    <p className={`font-bold text-sm truncate ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {isIncoming ? email.from_name : `To: ${email.to_email}`}
                    </p>
                    <p className="text-xs text-slate-500 flex-shrink-0 ml-2">
                        {formatDistanceToNow(new Date(isIncoming ? email.received_at : email.sent_at), { addSuffix: true })}
                    </p>
                </div>
                <p className={`text-sm truncate ${isUnread ? 'text-slate-700' : 'text-slate-600'}`}>{email.subject}</p>
            </div>
        );
    };

    const EmailViewer: React.FC<{ email: IncomingEmail | SentEmail }> = ({ email }) => {
        const isIncoming = 'from_name' in email;
        return (
            <div className="p-6 h-full flex flex-col">
                <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
                    <button onClick={() => setSelectedEmail(null)} className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                        <ArrowLeft className="w-4 h-4" /> Back to List
                    </button>
                    {isIncoming && (
                        <div className="flex gap-2">
                            <button onClick={() => handleStatusChange(email.id, 'unread')} title="Mark as Unread" className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"><EyeOff className="w-4 h-4" /></button>
                            <button onClick={() => handleStatusChange(email.id, 'archived')} title="Archive" className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"><Archive className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">{email.subject}</h2>
                <div className="flex justify-between items-center mb-4 text-sm">
                    <div className="text-slate-700">
                        {isIncoming ? (
                            <>
                                <span className="font-semibold">{email.from_name}</span>
                                <span className="text-slate-500"> &lt;{email.from_email}&gt;</span>
                            </>
                        ) : (
                            <>
                                <span className="font-semibold">You</span>
                                <span className="text-slate-500"> to &lt;{email.to_email}&gt;</span>
                            </>
                        )}
                    </div>
                    <p className="text-slate-500">{format(new Date(isIncoming ? email.received_at : email.sent_at), 'MMM d, yyyy, h:mm a')}</p>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <p className="whitespace-pre-wrap text-slate-800">{email.body}</p>
                </div>
                {isIncoming && (
                    <a href={`mailto:${email.from_email}?subject=Re: ${email.subject}`} className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-center">
                        Reply to {email.from_name}
                    </a>
                )}
            </div>
        );
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Mail className="w-7 h-7 text-indigo-600" /> Email Inbox
                </h1>

                <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden h-[70vh] flex">
                    <div className="w-1/3 border-r border-slate-200 flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex gap-2">
                                <button onClick={() => setActiveTab('inbox')} className={`px-3 py-1 rounded-full text-sm font-semibold ${activeTab === 'inbox' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Inbox</button>
                                <button onClick={() => setActiveTab('sent')} className={`px-3 py-1 rounded-full text-sm font-semibold ${activeTab === 'sent' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Sent</button>
                            </div>
                            <button onClick={fetchData} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"><RefreshCw className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-full"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {(activeTab === 'inbox' ? incomingEmails : sentEmails).map(email => (
                                        <EmailListItem key={email.id} email={email} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="w-2/3">
                        {selectedEmail ? (
                            <EmailViewer email={selectedEmail} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <Inbox className="w-12 h-12 mb-4" />
                                <p>Select an email to view it</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminInbox;