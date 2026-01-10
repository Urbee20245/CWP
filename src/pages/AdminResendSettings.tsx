"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Send, Save, Loader2, AlertTriangle, CheckCircle2, Mail, Settings, ExternalLink } from 'lucide-react';
import { AdminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

interface ResendSettings {
    id: string;
    api_key_encrypted: string;
    from_name: string;
    from_email: string;
    is_active: boolean;
}

const AdminResendSettings: React.FC = () => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<Partial<ResendSettings>>({});
    const [apiKey, setApiKey] = useState(''); // Plain text API key input
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<'idle' | 'success' | 'failed'>('idle');

    const fetchSettings = useCallback(async () => {
        try {
            const data = await AdminService.getResendSettings();
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveError(null);
        
        const payload = {
            ...settings,
            // Only include API key if it was changed (i.e., apiKey state is not empty)
            ...(apiKey && { api_key_encrypted: apiKey }),
            // Ensure ID is set for upsert
            id: settings.id || '00000000-0000-0000-0000-000000000000',
        };

        try {
            const savedSettings = await AdminService.saveResendSettings(payload);
            setSettings(savedSettings);
            setApiKey(''); // Clear plain text API key after successful save
            alert('Resend Settings saved successfully!');
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
        setSaveError(null);
        
        try {
            await AdminService.sendEmail(
                user.email, 
                "Resend API Test Email from CWP", 
                `<p>This is a test email sent from the Custom Websites Plus system using your configured Resend API settings.</p><p>If you received this, your configuration is correct!</p>`,
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
    
    const renderDetailedError = (errorMessage: string) => {
        if (errorMessage.includes('Failed to decrypt API key')) {
            return (
                <div>
                    <p className="font-bold">Decryption Error:</p>
                    <p className="mt-1 text-xs">The <code className="font-mono bg-red-200 px-1 rounded">SMTP_ENCRYPTION_KEY</code> secret in Supabase is likely missing or incorrect. This key is used to encrypt the Resend API key. Please verify the key and re-enter/save the API key.</p>
                </div>
            );
        }
        if (errorMessage.includes('Resend API failed')) {
            return (
                <div>
                    <p className="font-bold">Resend API Error:</p>
                    <p className="mt-1 text-xs">The API key may be invalid, or the 'From Email' is not a verified domain in your Resend account.</p>
                </div>
            );
        }
        
        return (
            <div>
                <p className="font-bold">Detailed Error:</p>
                <p className="mt-1 text-xs font-mono break-all">{errorMessage}</p>
                <p className="mt-2 text-xs">Check Supabase Edge Function logs for more details.</p>
            </div>
        );
    };

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Link to="/admin/settings" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 block">
                    ← Back to Settings
                </Link>
                
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <Send className="w-7 h-7 text-emerald-600" /> Resend API Settings
                </h1>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    <h2 className="text-xl font-bold mb-4 border-b border-slate-100 pb-4 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-emerald-600" /> Resend Configuration
                    </h2>
                    
                    {saveError && (
                        <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {renderDetailedError(saveError)}
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-4">
                        
                        {/* API Key */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Resend API Key {settings.api_key_encrypted ? '(Leave blank to keep existing)' : '*'}</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={settings.api_key_encrypted ? '••••••••' : 're_xxxxxxxxxxxxxxxxxxxx'}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                required={!settings.api_key_encrypted}
                                disabled={isSaving}
                            />
                            <p className="text-xs text-slate-500 mt-1">The API key is encrypted and stored securely.</p>
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
                                    placeholder="noreply@yourdomain.com"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                    disabled={isSaving}
                                />
                                <p className="text-xs text-red-500 mt-1">Must be a verified domain/email in Resend.</p>
                            </div>
                        </div>
                        
                        {/* Active Toggle */}
                        <div className="flex items-center gap-4 pt-2">
                            <label className="flex items-center text-sm font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={settings.is_active || false}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 mr-2"
                                    disabled={isSaving}
                                />
                                Active Configuration (Use Resend for all transactional emails)
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
                                disabled={isTesting || isSaving || !settings.from_email}
                                className={`flex-1 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                                    isTesting ? 'bg-slate-400 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                }`}
                            >
                                {isTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
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
                                Test email failed. See error details above.
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminResendSettings;