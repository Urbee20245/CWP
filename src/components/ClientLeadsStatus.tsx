"use client";

import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "../integrations/supabase/client";

type StatusResponse = {
  enabled: boolean;
  active_count: number;
  total_count: number;
  last_lead_at: string | null;
};

export default function ClientLeadsStatus({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("get-leads-status", { body: {} });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (parsed?.error) {
      setError(parsed.error);
      setLoading(false);
      return;
    }
    setStatus(parsed as StatusResponse);
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRefresh = async () => {
    setBusy(true);
    await fetchStatus();
    setBusy(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
        Leads Status
      </h2>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {!error && status && (
        <>
          {status.enabled ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Leads Connected
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Leads Disabled
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold">Active</p>
              <p className="text-lg font-bold text-slate-900">{status.active_count} / 50</p>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total</p>
              <p className="text-lg font-bold text-slate-900">{status.total_count}</p>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold">Last Lead</p>
              <p className="text-sm font-semibold text-slate-900">
                {status.last_lead_at ? new Date(status.last_lead_at).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleRefresh}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}