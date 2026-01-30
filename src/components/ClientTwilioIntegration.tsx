"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Phone, Save, Loader2, AlertTriangle, CheckCircle2, MessageSquare, ExternalLink, Clock, Info } from 'lucide-react';
import { ClientIntegrationService } from '../services/clientIntegrationService';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import confetti from 'canvas-confetti';

interface ClientTwilioIntegrationProps {
  clientId: string;
}

const ClientTwilioIntegration: React.FC<ClientTwilioIntegrationProps> = ({ clientId }) => {
  const [formData, setFormData] = useState({
    accountSid: '',
    authToken: '',
    phoneNumber: '',
  });
  const [config, setConfig] = useState<{ configured: boolean, phone_number?: string, masked_sid?: string, updated_at?: string } | null>(null);
  const [a2pStatus, setA2pStatus] = useState<'not_started' | 'pending_approval' | 'approved' | 'rejected'>('not_started');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Twilio Config (Encrypted details)
      const result = await ClientIntegrationService.getTwilioConfig(clientId);
      setConfig(result);
      if (result.configured) {
        setFormData(prev => ({
            ...prev,
            phoneNumber: result.phone_number || '',
        }));
      }

      // 2. Fetch A2P Status (from client_voice_integrations)
      const { data: voiceData } = await supabase
        .from('client_voice_integrations')
        .select('a2p_status, voice_status')
        .eq('client_id', clientId)
        .maybeSingle();

      if (voiceData) {
          setA2pStatus(voiceData.a2p_status as any || 'not_started');
      }

    } catch (e: any) {
      console.error('Error fetching config:', e);
      // Don't show error message if it's just that no config exists yet
      if (!e.message?.includes('not authenticated')) {
        setStatusMessage({ type: 'error', message: `Failed to load configuration: ${e.message}` });
      }
      // Set config to not configured if there's an error
      setConfig({ configured: false });
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

      // Trigger confetti celebration!
      triggerConfetti();

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
  
  const isA2PPending = a2pStatus !== 'approved';
  const isConfigured = config?.configured;

  // Confetti celebration function
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-32"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-4">
      
      {/* Status Display */}
      {isConfigured && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
            <p className="font-bold mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Credentials Saved
            </p>
            <p>Phone Number: <span className="font-mono font-semibold">{config.phone_number}</span></p>
            <p>Account SID: <span className="font-mono font-semibold">***{config.masked_sid}</span> (Last 4 chars)</p>
            <p className="text-xs text-slate-500 mt-1">Last Updated: {config.updated_at ? format(new Date(config.updated_at), 'MMM dd, yyyy h:mm a') : 'N/A'}</p>
        </div>
      )}
      
      {/* Info about next steps */}
      {isConfigured && (
          <div className="p-3 rounded-lg text-sm flex items-center gap-2 bg-blue-100 border-blue-300 text-blue-800">
              <Info className="w-4 h-4" />
              <div>
                  <p className="font-bold">Credentials Configured</p>
                  <p className="text-xs mt-0.5">
                      Your Twilio credentials are saved. You can test the connection below. Our team will handle the rest from here.
                  </p>
              </div>
          </div>
      )}
      
      {statusMessage && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
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
                disabled={isTesting || isSaving || !isConfigured}
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