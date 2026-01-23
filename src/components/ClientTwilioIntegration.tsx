"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Phone, Save, Loader2, AlertTriangle, CheckCircle2, MessageSquare, ExternalLink, Clock } from 'lucide-react';
import { ClientIntegrationService } from '../services/clientIntegrationService';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { Link } from 'react-router-dom'; // <-- ADDED IMPORT

interface ClientTwilioIntegrationProps {
  clientId: string;
}

const ClientTwilioIntegration: React.FC<ClientTwilioIntegrationProps> = ({ clientId }) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    accountSid: '',
    authToken: '',
    phoneNumber: '',
  });
  const [config, setConfig] = useState<{ configured: boolean, phone_number?: string, masked_sid?: string, updated_at?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await ClientIntegrationService.getTwilioConfig(clientId);
      setConfig(result);
      if (result.configured) {
        setFormData(prev => ({
            ...prev,
            phoneNumber: result.phone_number || '',
        }));
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', message: `Failed to load configuration: ${e.message}` });
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    const { accountSid, authToken, phoneNumber } = formData;

    if (!accountSid || !authToken || !phoneNumber) {
      setStatusMessage({ type: 'error', message: 'All fields are required to save credentials.' });
      setIsSaving(false);
      return;
    }
    
    // Basic E.164 validation
    if (!phoneNumber.startsWith('+1') || phoneNumber.length < 12) {
        setStatusMessage({ type: 'error', message: 'Phone number must be in E.164 format (e.g., +14045551234).' });
        setIsSaving(false);
        return;
    }

    try {
      await ClientIntegrationService.saveTwilioCredentials(clientId, accountSid, authToken, phoneNumber);
      
      setStatusMessage({ type: 'success', message: 'Credentials saved and secured successfully! Running connection test...' });
      
      // Clear sensitive fields after successful save
      setFormData(prev => ({ ...prev, accountSid: '', authToken: '' }));
      
      // Immediately run test connection
      await handleTestConnection();
      
      fetchConfig(); // Refresh masked config
      
    } catch (e: any) {
      setStatusMessage({ type: 'error', message: `Save failed: ${e.message}` });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMessage({ type: 'info', message: 'Testing connection with Twilio...' });
    
    try {
        const result = await ClientIntegrationService.testTwilioConnection(clientId);
        
        if (result.success) {
            setStatusMessage({ type: 'success', message: result.message });
        } else {
            setStatusMessage({ type: 'error', message: `Test Failed: ${result.message}` });
        }
    } catch (e: any) {
        setStatusMessage({ type: 'error', message: `Test failed due to server error. Check console.` });
    } finally {
        setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-32"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
        <Phone className="w-5 h-5 text-indigo-600" /> Phone & Messaging Integration
      </h2>
      
      <p className="text-sm text-slate-600 mb-6">
        Connect your business phone number for automated call handling, AI voice agents, and SMS notifications.
      </p>

      {/* Status Display */}
      {config?.configured && (
        <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
            <p className="font-bold mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Integration Active
            </p>
            <p>Phone Number: <span className="font-mono font-semibold">{config.phone_number}</span></p>
            <p>Account SID: <span className="font-mono font-semibold">***{config.masked_sid}</span> (Last 4 chars)</p>
            <p className="text-xs text-slate-500 mt-1">Last Updated: {config.updated_at ? format(new Date(config.updated_at), 'MMM dd, yyyy h:mm a') : 'N/A'}</p>
        </div>
      )}
      
      {statusMessage && (
        <div className={`p-3 mb-4 rounded-lg text-sm flex items-center gap-2 ${
            statusMessage.type === 'success' ? 'bg-emerald-100 border-emerald-300 text-emerald-800' :
            statusMessage.type === 'error' ? 'bg-red-100 border-red-300 text-red-800' :
            'bg-blue-100 border-blue-300 text-blue-800'
        }`}>
          {statusMessage.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {statusMessage.message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        
        <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
            <h3 className="font-bold text-slate-700 mb-3">Twilio Credentials (Required for AI Voice)</h3>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account SID *</label>
                <input
                    type="password"
                    name="accountSid"
                    value={formData.accountSid}
                    onChange={handleChange}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                    required
                    disabled={isSaving || isTesting}
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Auth Token *</label>
                <input
                    type="password"
                    name="authToken"
                    value={formData.authToken}
                    onChange={handleChange}
                    placeholder="Your Twilio Auth Token"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                    required
                    disabled={isSaving || isTesting}
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (E.164) *</label>
                <input
                    type="text"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    placeholder="+14045551234"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                    required
                    disabled={isSaving || isTesting}
                />
                <p className="text-xs text-slate-500 mt-1">Must be in E.164 format (e.g., +1...).</p>
            </div>
        </div>

        <div className="flex gap-3">
            <button
                type="submit"
                disabled={isSaving || isTesting || !formData.accountSid || !formData.authToken || !formData.phoneNumber}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isSaving ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Saving & Securing...
                    </>
                ) : (
                    <>
                        <Save className="w-5 h-5" />
                        Save & Secure
                    </>
                )}
            </button>
            
            <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || isSaving || !config?.configured}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isTesting ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Testing...
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="w-5 h-5" />
                        Test Connection
                    </>
                )}
            </button>
        </div>
        
        <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Need help setting up Twilio?</p>
            <Link to="/client/help" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
                View Twilio Setup Guide <ExternalLink className="w-4 h-4" />
            </Link>
        </div>
      </form>
    </div>
  );
};

export default ClientTwilioIntegration;