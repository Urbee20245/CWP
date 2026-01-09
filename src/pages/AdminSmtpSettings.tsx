"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Mail, Save, Loader2, AlertTriangle, CheckCircle2, Send, Settings } from 'lucide-react';
import { AdminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';

interface SmtpSettings {
    id: string;
    host: string;
    port: number;
    secure: boolean;
    password_encrypted: string; // We only store the encrypted version
    username: string;
    from_name: string;
    from_email: string;
    is_active: boolean;
}

const AdminSmtpSettings: React.FC = () => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<Partial<SmtpSettings>>({});
    const [password, setPassword] = useState(''); // Plain text password input
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<'idle' | 'success' | 'failed'>('idle');

    const fetchSettings = useCallback(async () => {
        try {
            const data = await AdminService.getSmtpSettings();
            if (data) {
                setSettings(data);
            }
        } catch (e: any) {
            setSaveError(`Failed to load settings: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (name === 'port' ? parseInt(value) : value),
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveError(null);
        
        const payload = {
            ...settings,
            // Only include password if it was changed (i.e., password state is not empty)
            ...(password && { password_encrypted: password }),
            // Ensure ID is set for upsert
            id: settings.id || '00000000-0000-0000-0000-000000000000',
        };

        try {
            const savedSettings = await AdminService.saveSmtpSettings(payload);
            setSettings(savedSettings);
            setPassword(''); // Clear plain text password after successful save
            alert('SMTP Settings saved successfully!');
        } catch (e: any) {
            setSaveError(e.message || 'Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleTestEmail = async () => {
        if (!user || !settings.from_email) {
            alert("Please save your settings and ensure you are logged in.");
            return;
        }
        setIsTesting(true);
        setTestResult('idle');
        setSaveError(null); // Clear previous error before testing
        
        try {
            await AdminService.sendEmail(
                user.email, 
                "SMTP Test Email from CWP", 
                `<p>This is a test email sent from the Custom Websites Plus system using your configured SMTP settings.</p><p>If you received this, your configuration is correct!</p>`,
                null, // No client ID
                user.id
            );
            setTestResult('success');
        } catch (e: any) {
            setTestResult('failed');
            setSaveError(e.message || 'Test failed due to an unknown error.');
        } finally {
            setIsTesting(false);
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

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Mail className="w-7 h-7 text-indigo-600" /> Email (SMTP) Settings
                </h1>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-600" /> SMTP Configuration
                    </h2>
                    
                    {saveError && (
                        <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {saveError.includes('non-2xx') || saveError.includes('Failed to call') ? (
                                <div>
                                    <p className="font-bold">Test failed: Check Supabase Logs for detailed error.</p>
                                    <p className="mt-1 text-xs">This usually means the SMTP server rejected the connection or the password decryption failed. Ensure the <code className="font-mono bg-red-200 px-1 rounded">SMTP_ENCRYPTION_KEY</code> secret is set correctly in Supabase.</p>
                                </div>
                            ) : (
                                saveError
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-4">
                        
                        {/* Host & Port */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">SMTP Host *</label>
                                <input
                                    type="text"
                                    name="host"
                                    value={settings.host || ''}
                                    onChange={handleChange}
                                    placeholder="smtp.example.com"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isSaving}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Port *</label>
                                <input
                                    type="number"
                                    name="port"
                                    value={settings.port || ''}
                                    onChange={handleChange}
                                    placeholder="587 or 465"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                        
                        {/* Auth */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Username *</label>
                                <input
                                    type="text"
                                    name="username"
                                    value={settings.username || ''}
                                    onChange={handleChange}
                                    placeholder="user@example.com"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isSaving}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Password {settings.password_encrypted ? '(Leave blank to keep existing)' : '*'}</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={settings.password_encrypted ? '••••••••' : 'Enter password'}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required={!settings.password_encrypted}
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                        
                        {/* From Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">From Name *</label>
                                <input
                                    type="text"
                                    name="from_name"
                                    value={settings.from_name || ''}
                                    onChange={handleChange}
                                    placeholder="Custom Websites Plus"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isSaving}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">From Email *</label>
                                <input
                                    type="email"
                                    name="from_email"
                                    value={settings.from_email || ''}
                                    onChange={handleChange}
                                    placeholder="noreply@example.com"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                        
                        {/* Secure Toggle */}
                        <div className="flex items-center gap-4 pt-2">
                            <label className="flex items-center text-sm font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    name="secure"
                                    checked={settings.secure || false}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mr-2"
                                    disabled={isSaving}
                                />
                                Use SSL/TLS (Secure Connection)
                            </label>
                            <label className="flex items-center text-sm font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={settings.is_active || false}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 mr-2"
                                    disabled={isSaving}
                                />
                                Active Configuration
                            </label>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {isSaving ? 'Saving...' : 'Save Settings'}
                            </button>
                            <button
                                type="button"
                                onClick={handleTestEmail}
                                disabled={isTesting || isSaving || !settings.host || !settings.from_email}
                                className={`flex-1 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                                    isTesting ? 'bg-slate-400 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                }`}
                            >
                                {isTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                {isTesting ? 'Testing...' : 'Send Test Email'}
                            </button>
                        </div>
                        
                        {testResult === 'success' && (
                            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Test email sent successfully to {user?.email}!
                            </div>
                        )}
                        {testResult === 'failed' && (
                            <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Test email failed. Check logs and credentials.
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminSmtpSettings;