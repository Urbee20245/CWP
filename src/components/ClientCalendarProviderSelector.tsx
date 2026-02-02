"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Info, Loader2, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

type CalendarProvider = 'none' | 'cal' | 'google';

interface Props {
  clientId: string;
}

const ClientCalendarProviderSelector: React.FC<Props> = ({ clientId }) => {
  const [provider, setProvider] = useState<CalendarProvider>('none');
  const [initialProvider, setInitialProvider] = useState<CalendarProvider>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [calConnected, setCalConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  const canSave = useMemo(() => {
    if (isSaving) return false;
    return provider !== initialProvider;
  }, [provider, initialProvider, isSaving]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [{ data: settingsRow, error: settingsErr }, { data: calRow, error: calErr }, { data: googleRow, error: googleErr }] = await Promise.all([
        supabase
          .from('ai_agent_settings')
          .select('calendar_provider')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase
          .from('client_cal_calendar')
          .select('connection_status, refresh_token_present, default_event_type_id')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase
          .from('client_google_calendar')
          .select('connection_status, refresh_token_present')
          .eq('client_id', clientId)
          .maybeSingle(),
      ]);

      if (settingsErr) throw settingsErr;
      if (calErr) throw calErr;
      if (googleErr) throw googleErr;

      const p = (settingsRow?.calendar_provider as CalendarProvider | undefined) || 'none';
      setProvider(p);
      setInitialProvider(p);

      setCalConnected(
        !!(
          calRow &&
          calRow.connection_status === 'connected' &&
          calRow.refresh_token_present === true &&
          calRow.default_event_type_id &&
          String(calRow.default_event_type_id).trim()
        )
      );
      setGoogleConnected(!!(googleRow && googleRow.connection_status === 'connected' && googleRow.refresh_token_present === true));
    } catch (e: any) {
      setError(e?.message || 'Failed to load booking provider.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const { error: upsertErr } = await supabase
        .from('ai_agent_settings')
        .upsert({
          client_id: clientId,
          calendar_provider: provider,
        }, { onConflict: 'client_id' });

      if (upsertErr) throw upsertErr;

      setInitialProvider(provider);
      setNotice('Booking provider saved. The AI will use only the selected provider (no fallback).');
    } catch (e: any) {
      setError(e?.message || 'Failed to save booking provider.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-16">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
        <Calendar className="w-5 h-5 text-indigo-600" /> Booking Provider
      </h2>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 text-slate-500" />
        <div>
          <p className="font-semibold">Choose ONE provider</p>
          <p className="text-xs text-slate-600 mt-1">The AI will use only the selected provider. If it’s not connected, booking/availability will be unavailable (no automatic fallback).</p>
        </div>
      </div>

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

      <div className="space-y-2">
        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${provider === 'cal' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
          <input
            type="radio"
            name="calendar_provider"
            className="mt-1"
            checked={provider === 'cal'}
            onChange={() => setProvider('cal')}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Cal.com</p>
            <p className="text-xs text-slate-600">Status: {calConnected ? 'Connected' : 'Not connected / missing Event Type ID'}</p>
          </div>
        </label>

        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${provider === 'google' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
          <input
            type="radio"
            name="calendar_provider"
            className="mt-1"
            checked={provider === 'google'}
            onChange={() => setProvider('google')}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Google Calendar</p>
            <p className="text-xs text-slate-600">Status: {googleConnected ? 'Connected' : 'Not connected'}</p>
          </div>
        </label>

        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${provider === 'none' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
          <input
            type="radio"
            name="calendar_provider"
            className="mt-1"
            checked={provider === 'none'}
            onChange={() => setProvider('none')}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Not configured</p>
            <p className="text-xs text-slate-600">AI won’t check availability or book meetings.</p>
          </div>
        </label>
      </div>

      <button
        onClick={save}
        disabled={!canSave}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Provider
      </button>
    </div>
  );
};

export default ClientCalendarProviderSelector;
