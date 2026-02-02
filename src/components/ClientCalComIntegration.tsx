"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Loader2, CheckCircle2, AlertTriangle, ExternalLink, X, Info, Save } from 'lucide-react';
import { ClientIntegrationService } from '../services/clientIntegrationService';
import { format } from 'date-fns';

interface Props {
  clientId: string;
}

interface CalStatus {
  connection_status: 'connected' | 'disconnected' | 'needs_reauth';
  updated_at: string;
  refresh_token_present?: boolean;
  reauth_reason?: string | null;
  last_error?: string | null;
  default_event_type_id?: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isLikelyTransientInitialError = (message: string) => {
  const msg = message.toLowerCase();
  return (
    msg.includes('edge function returned a non-2xx status code') ||
    msg.includes('jwt') ||
    (msg.includes('auth') && msg.includes('session')) ||
    msg.includes('failed to fetch')
  );
};

const ClientCalComIntegration: React.FC<Props> = ({ clientId }) => {
  const [status, setStatus] = useState<CalStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [eventTypeIdDraft, setEventTypeIdDraft] = useState('');
  const [isSavingEventType, setIsSavingEventType] = useState(false);

  const initialFetchRef = useRef(true);
  const requestIdRef = useRef(0);

  const fetchStatus = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isInitialFetch = initialFetchRef.current;

    setIsLoading(true);
    setError(null);

    const run = async () => {
      const data = await ClientIntegrationService.getCalComStatus(clientId);
      if (requestId !== requestIdRef.current) return;
      setStatus(data as CalStatus | null);
    };

    try {
      await run();
    } catch (e: any) {
      const message = e?.message || 'Failed to fetch Cal.com status.';

      if (isInitialFetch && isLikelyTransientInitialError(message)) {
        await sleep(500);
        try {
          await run();
        } catch (retryErr: any) {
          if (requestId !== requestIdRef.current) return;
          setError(retryErr?.message || message);
        }
      } else if (isInitialFetch) {
        await sleep(500);
        try {
          await run();
        } catch (retryErr: any) {
          if (requestId !== requestIdRef.current) return;
          setError(retryErr?.message || message);
        }
      } else {
        if (requestId !== requestIdRef.current) return;
        setError(message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
      initialFetchRef.current = false;
    }
  }, [clientId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    setEventTypeIdDraft(status?.default_event_type_id || '');
  }, [status?.default_event_type_id]);

  // Detect success flag after returning from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('provider');
    const oauthStatus = params.get('status');

    if (provider === 'cal') {
      if (oauthStatus === 'success') {
        setNotice('Cal.com authorized successfully. Booking via Cal.com is now enabled.');
      } else if (oauthStatus === 'needs_reauth') {
        setNotice('Cal.com authorized, but we still need one-time re-authorization to enable full access.');
      }
    }
  }, []);

  const handleConnect = async () => {
    setIsProcessing(true);
    setError(null);
    setNotice(null);
    try {
      const returnTo = `${window.location.origin}/client/settings`;
      const result = await ClientIntegrationService.initCalComAuth(clientId, returnTo);
      window.location.href = result.auth_url;
    } catch (e: any) {
      setError(e.message || 'Failed to initiate Cal.com OAuth.');
      setIsProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Cal.com?")) return;
    setIsProcessing(true);
    setError(null);
    try {
      await ClientIntegrationService.disconnectCalCom(clientId);
      await fetchStatus();
      setNotice(null);
      setIsProcessing(false);
    } catch (e: any) {
      setError(e.message || 'Failed to disconnect Cal.com.');
      setIsProcessing(false);
    }
  };

  const saveEventTypeId = async () => {
    setIsSavingEventType(true);
    setError(null);
    setNotice(null);
    try {
      await ClientIntegrationService.setCalComDefaultEventTypeId(clientId, eventTypeIdDraft);
      await fetchStatus();
      setNotice('Default Event Type ID saved.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save Event Type ID.');
    } finally {
      setIsSavingEventType(false);
    }
  };

  const isConnected = status?.connection_status === 'connected' && status?.refresh_token_present === true;
  const needsReauth = status?.connection_status === 'needs_reauth' || (status?.connection_status === 'connected' && status?.refresh_token_present === false);

  const needsEventType = isConnected && !(status?.default_event_type_id && status.default_event_type_id.trim());

  const eventTypeSaveDisabled = useMemo(() => {
    const current = (status?.default_event_type_id || '').trim();
    const next = eventTypeIdDraft.trim();
    if (!isConnected) return true;
    if (isSavingEventType) return true;
    return current === next;
  }, [eventTypeIdDraft, isConnected, isSavingEventType, status?.default_event_type_id]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
        <Calendar className="w-5 h-5 text-indigo-600" /> Cal.com Integration
      </h2>

      {notice && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {notice}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {isConnected ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="font-bold text-emerald-800">Cal.com Connected</p>
          </div>

          <p className="text-sm text-emerald-700">This is the preferred booking provider for your AI agent.</p>

          <div className="p-3 bg-white/60 rounded-lg border border-emerald-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">Default Event Type ID</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                value={eventTypeIdDraft}
                onChange={(e) => setEventTypeIdDraft(e.target.value)}
                placeholder="e.g. 123456"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
              <button
                onClick={saveEventTypeId}
                disabled={eventTypeSaveDisabled}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSavingEventType ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
            {needsEventType ? (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-semibold">Required to book calls</p>
                  <p className="mt-0.5">
                    Find this inside Cal.com by opening your event type → URL or settings, then copy its numeric ID.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 mt-2">
                Used for both availability checks and booking.
              </p>
            )}
          </div>

          {status?.updated_at && (
            <p className="text-xs text-slate-500">Last Updated: {format(new Date(status.updated_at), 'MMM dd, yyyy h:mm a')}</p>
          )}

          <button
            onClick={handleDisconnect}
            disabled={isProcessing}
            className="mt-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Disconnect Cal.com
          </button>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            <p className="font-bold text-slate-700">{needsReauth ? 'Needs Re-Authorization' : 'Not Connected'}</p>
          </div>

          {needsReauth ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-semibold">One-time fix required</p>
                <p className="text-xs mt-1">Please reconnect Cal.com so we can securely store a refresh token.</p>
                {status?.last_error && (
                  <p className="text-xs mt-1"><span className="font-semibold">Last error:</span> {status.last_error}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-semibold">Recommended</p>
                <p className="text-xs mt-1">Cal.com is our preferred booking provider for Retell AI automation.</p>
              </div>
            </div>
          )}

          <p className="text-sm text-slate-600">Connect your Cal.com account so the AI agent can check availability and book meetings.</p>
          <button
            onClick={handleConnect}
            disabled={isProcessing}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
            {needsReauth ? 'Reconnect Cal.com' : 'Connect Cal.com'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientCalComIntegration;