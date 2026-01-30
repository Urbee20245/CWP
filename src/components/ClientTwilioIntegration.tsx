"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Phone, Save, Loader2, AlertTriangle, CheckCircle2, ExternalLink, Info, Link2, RefreshCw, ChevronDown } from 'lucide-react';
import { ClientIntegrationService } from '../services/clientIntegrationService';
import { supabase } from '../integrations/supabase/client';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';

// The Connect App SID is a public identifier — safe to use client-side.
// The admin sets this in Supabase secrets as TWILIO_CONNECT_APP_SID.
// We also check for a VITE_ prefixed version for frontend use.
const TWILIO_CONNECT_APP_SID = (import.meta as any).env?.VITE_TWILIO_CONNECT_APP_SID || '';

interface ClientTwilioIntegrationProps {
  clientId: string;
}

interface TwilioPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities?: { voice?: boolean; sms?: boolean };
}

const ClientTwilioIntegration: React.FC<ClientTwilioIntegrationProps> = ({ clientId }) => {
  // Config state
  const [config, setConfig] = useState<{
    configured: boolean;
    phone_number?: string;
    masked_sid?: string;
    updated_at?: string;
    connection_method?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  // Phone number selection
  const [phoneNumbers, setPhoneNumbers] = useState<TwilioPhoneNumber[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // Manual credential entry (fallback)
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [formData, setFormData] = useState({ accountSid: '', authToken: '', phoneNumber: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const isConfigured = config?.configured;
  const isConnectMethod = config?.connection_method === 'twilio_connect';

  // ---- Data Fetching ----

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await ClientIntegrationService.getTwilioConfig(clientId);
      setConfig(result);
      if (result.configured && result.phone_number) {
        setSelectedPhone(result.phone_number);
        setFormData(prev => ({ ...prev, phoneNumber: result.phone_number || '' }));
      }
    } catch (e: any) {
      console.error('Error fetching config:', e);
      if (!e.message?.includes('not authenticated')) {
        setStatusMessage({ type: 'error', message: `Failed to load configuration: ${e.message}` });
      }
      setConfig({ configured: false });
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  const fetchPhoneNumbers = useCallback(async () => {
    if (!isConfigured) return;
    setIsLoadingNumbers(true);
    try {
      const result = await ClientIntegrationService.getTwilioPhoneNumbers(clientId);
      setPhoneNumbers(result.phone_numbers || []);
      if (result.selected_phone) {
        setSelectedPhone(result.selected_phone);
      }
    } catch (e: any) {
      console.error('Error fetching phone numbers:', e);
      // Don't show error — numbers list is supplementary
    } finally {
      setIsLoadingNumbers(false);
    }
  }, [clientId, isConfigured]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => { if (isConfigured) fetchPhoneNumbers(); }, [isConfigured, fetchPhoneNumbers]);

  // ---- Twilio Connect Flow ----

  const handleConnectWithTwilio = () => {
    if (!TWILIO_CONNECT_APP_SID) {
      setStatusMessage({
        type: 'error',
        message: 'Twilio Connect is not configured. Please contact support or use manual entry below.',
      });
      setShowManualEntry(true);
      return;
    }
    // Redirect to Twilio Connect authorization page
    // After authorization, Twilio redirects to the configured callback URL
    // which should be: https://yourdomain.com/twilio-callback
    window.location.href = `https://www.twilio.com/authorize/${TWILIO_CONNECT_APP_SID}`;
  };

  // ---- Phone Number Selection ----

  const handleSelectPhone = async () => {
    if (!selectedPhone) {
      setStatusMessage({ type: 'error', message: 'Please select a phone number.' });
      return;
    }
    setIsSavingPhone(true);
    setStatusMessage(null);
    try {
      await ClientIntegrationService.selectTwilioPhoneNumber(clientId, selectedPhone);
      triggerConfetti();
      setStatusMessage({ type: 'success', message: 'Phone number saved! Our team will configure AI call handling for this number.' });
      fetchConfig();
    } catch (e: any) {
      setStatusMessage({ type: 'error', message: `Failed to save number: ${e.message}` });
    } finally {
      setIsSavingPhone(false);
    }
  };

  // ---- Manual Credential Entry (Fallback) ----

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    const { accountSid, authToken, phoneNumber } = formData;

    if (!accountSid || !authToken || !phoneNumber) {
      setStatusMessage({ type: 'error', message: 'All fields are required to save credentials.' });
      setIsSaving(false);
      return;
    }

    if (!phoneNumber.startsWith('+') || phoneNumber.length < 11) {
      setStatusMessage({ type: 'error', message: 'Phone number must be in E.164 format (e.g., +14045551234).' });
      setIsSaving(false);
      return;
    }

    try {
      await ClientIntegrationService.saveTwilioCredentials(clientId, accountSid, authToken, phoneNumber);
      triggerConfetti();
      setStatusMessage({ type: 'success', message: 'Credentials saved and secured! Running connection test...' });
      setFormData(prev => ({ ...prev, accountSid: '', authToken: '' }));
      await handleTestConnection();
      fetchConfig();
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
      setStatusMessage({
        type: result.success ? 'success' : 'error',
        message: result.success ? result.message : `Test Failed: ${result.message}`,
      });
    } catch (e: any) {
      setStatusMessage({ type: 'error', message: 'Test failed due to server error. Check console.' });
    } finally {
      setIsTesting(false);
    }
  };

  // ---- Confetti ----

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  // ---- Render ----

  if (isLoading) {
    return <div className="flex justify-center items-center h-32"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-4">

      {/* Connected Status Display */}
      {isConfigured && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
          <p className="font-bold mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {isConnectMethod ? 'Twilio Connected via OAuth' : 'Credentials Saved'}
          </p>
          {config?.phone_number && (
            <p>Phone Number: <span className="font-mono font-semibold">{config.phone_number}</span></p>
          )}
          {config?.masked_sid && (
            <p>Account SID: <span className="font-mono font-semibold">***{config.masked_sid}</span></p>
          )}
          {config?.updated_at && (
            <p className="text-xs text-emerald-600 mt-1">
              Last Updated: {format(new Date(config.updated_at), 'MMM dd, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}

      {/* Phone Number Selector (shown after Connect or when numbers are available) */}
      {isConfigured && phoneNumbers.length > 0 && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <h4 className="font-bold text-indigo-800 text-sm mb-2 flex items-center gap-2">
            <Phone className="w-4 h-4" /> Select Phone Number for AI Calls
          </h4>
          <p className="text-xs text-indigo-600 mb-3">
            Choose which phone number should be used for AI voice agent calls.
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <select
                value={selectedPhone}
                onChange={(e) => setSelectedPhone(e.target.value)}
                className="w-full p-3 border border-indigo-300 rounded-lg text-sm bg-white appearance-none pr-10"
                disabled={isSavingPhone}
              >
                <option value="">Select a phone number...</option>
                {phoneNumbers.map((n) => (
                  <option key={n.sid} value={n.phone_number}>
                    {n.phone_number} {n.friendly_name ? `(${n.friendly_name})` : ''}
                    {n.capabilities?.voice ? '' : ' [No Voice]'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-indigo-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              onClick={handleSelectPhone}
              disabled={isSavingPhone || !selectedPhone}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              onClick={fetchPhoneNumbers}
              disabled={isLoadingNumbers}
              className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
              title="Refresh phone numbers"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-500 ${isLoadingNumbers ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Info about next steps */}
      {isConfigured && config?.phone_number && (
        <div className="p-3 rounded-lg text-sm flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800">
          <Info className="w-4 h-4 flex-shrink-0" />
          <div>
            <p className="font-bold">Ready for AI Setup</p>
            <p className="text-xs mt-0.5">
              Your Twilio account is connected and phone number is selected. Our team will configure the AI voice agent from here.
            </p>
          </div>
        </div>
      )}

      {/* Test Connection Button (when configured) */}
      {isConfigured && (
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting}
          className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isTesting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Testing...</>
          ) : (
            <><CheckCircle2 className="w-5 h-5" /> Test Connection</>
          )}
        </button>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          statusMessage.type === 'success' ? 'bg-emerald-100 border border-emerald-300 text-emerald-800' :
          statusMessage.type === 'error' ? 'bg-red-100 border border-red-300 text-red-800' :
          'bg-blue-100 border border-blue-300 text-blue-800'
        }`}>
          {statusMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
          <span>{statusMessage.message}</span>
        </div>
      )}

      {/* Connect with Twilio Button (Primary — when not yet configured) */}
      {!isConfigured && (
        <div className="space-y-4">
          <div className="p-6 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/50 text-center">
            <Link2 className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
            <h3 className="font-bold text-slate-900 mb-2">Connect Your Twilio Account</h3>
            <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
              Securely link your Twilio account with one click. We'll automatically detect your phone numbers.
            </p>
            <button
              onClick={handleConnectWithTwilio}
              className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2 mx-auto"
            >
              <svg className="w-5 h-5" viewBox="0 0 30 30" fill="currentColor">
                <path d="M15 0C6.7 0 0 6.7 0 15s6.7 15 15 15 15-6.7 15-15S23.3 0 15 0zm0 26C8.9 26 4 21.1 4 15S8.9 4 15 4s11 4.9 11 11-4.9 11-11 11zm-1-16.5c0-1.4-1.1-2.5-2.5-2.5S9 8.1 9 9.5 10.1 12 11.5 12 14 10.9 14 9.5zm4.5-2.5c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5S21 10.9 21 9.5 19.9 7 18.5 7zm-7 7c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5zm7 0c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5z"/>
              </svg>
              Connect with Twilio
            </button>
          </div>

          {/* Manual Entry Toggle */}
          <div className="text-center">
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="text-xs text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {showManualEntry ? 'Hide manual entry' : 'Or enter credentials manually'}
            </button>
          </div>
        </div>
      )}

      {/* Manual Credential Entry Form (Fallback) */}
      {showManualEntry && !isConfigured && (
        <form onSubmit={handleManualSave} className="space-y-4 border-t border-slate-200 pt-4">
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
            <h3 className="font-bold text-slate-700 mb-3">Manual Credential Entry</h3>
            <div className="space-y-3">
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
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving || !formData.accountSid || !formData.authToken || !formData.phoneNumber}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : <><Save className="w-5 h-5" /> Save & Secure</>}
          </button>
        </form>
      )}

      {/* Help Link */}
      <div className="pt-2 border-t border-slate-100">
        <Link to="/client/help" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
          Need help? View setup guide <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default ClientTwilioIntegration;
