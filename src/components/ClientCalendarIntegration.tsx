"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Loader2, CheckCircle2, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { ClientIntegrationService } from '../services/clientIntegrationService';
import { format } from 'date-fns';

interface ClientCalendarIntegrationProps {
  clientId: string;
}

interface CalendarStatus {
    connection_status: 'connected' | 'disconnected';
    calendar_id: string;
    updated_at: string;
}

const ClientCalendarIntegration: React.FC<ClientCalendarIntegrationProps> = ({ clientId }) => {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ClientIntegrationService.getGoogleCalendarStatus(clientId);
      setStatus(data as CalendarStatus | null);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch calendar status.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await ClientIntegrationService.initGoogleCalendarAuth(clientId);
      // Redirect the user to the Google OAuth URL
      window.location.href = result.auth_url;
    } catch (e: any) {
      setError(e.message || 'Failed to initiate Google OAuth.');
      setIsProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect your Google Calendar?")) return;
    setIsProcessing(true);
    setError(null);
    try {
      await ClientIntegrationService.disconnectGoogleCalendar(clientId);
      setStatus(prev => prev ? { ...prev, connection_status: 'disconnected' } : null);
      setIsProcessing(false);
    } catch (e: any) {
      setError(e.message || 'Failed to disconnect calendar.');
      setIsProcessing(false);
    }
  };

  const isConnected = status?.connection_status === 'connected';

  if (isLoading) {
    return <div className="flex justify-center items-center h-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
        <Calendar className="w-5 h-5 text-indigo-600" /> Google Calendar Integration
      </h2>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {isConnected ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="font-bold text-emerald-800">Calendar Connected</p>
          </div>
          <p className="text-sm text-emerald-700">
            Events will be automatically created in your calendar: <span className="font-mono font-semibold">{status.calendar_id}</span>
          </p>
          <p className="text-xs text-slate-500">Last Synced: {format(new Date(status.updated_at), 'MMM dd, yyyy h:mm a')}</p>
          
          <button
            onClick={handleDisconnect}
            disabled={isProcessing}
            className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Disconnect Calendar
          </button>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            <p className="font-bold text-slate-700">Not Connected</p>
          </div>
          <p className="text-sm text-slate-600">
            Connect your Google Calendar to automatically book appointments from your website forms.
          </p>
          <button
            onClick={handleConnect}
            disabled={isProcessing}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
            Connect Google Calendar
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientCalendarIntegration;