"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { Copy, KeyRound, Loader2, ShieldCheck, RotateCw, Info, Globe, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";

type LeadConfig = {
  client_id: string;
  ingest_key: string;
  enabled: boolean;
  allowed_origins: string[] | null;
  updated_at: string;
};

function maskKey(key: string) {
  if (!key) return "";
  if (key.length <= 10) return "••••••";
  return `${key.slice(0, 6)}••••••${key.slice(-4)}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AdminClientLeadsPanel({ clientId }: { clientId: string }) {
  const [config, setConfig] = useState<LeadConfig | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [originsText, setOriginsText] = useState("");

  const [activeCount, setActiveCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [lastLeadAt, setLastLeadAt] = useState<string | null>(null);

  const endpoint = useMemo(
    () => "https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/ingest-lead",
    []
  );

  const fetchConfig = useCallback(async () => {
    setError(null);

    const { data, error } = await supabase
      .from("client_lead_ingest_configs")
      .select("client_id, ingest_key, enabled, allowed_origins, updated_at")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setConfig(null);
      return;
    }

    const cfg = (data as any) || null;
    setConfig(cfg);
    setOriginsText((cfg?.allowed_origins || []).join(", "));
  }, [clientId]);

  const fetchDiagnostics = useCallback(async () => {
    const { count: active, error: activeErr } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .neq("status", "resolved")
      .neq("status", "archived");

    if (!activeErr) setActiveCount(active || 0);

    const { count: total, error: totalErr } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    if (!totalErr) setTotalCount(total || 0);

    const { data: lastLead } = await supabase
      .from("leads")
      .select("created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLastLeadAt(lastLead?.created_at || null);
  }, [clientId]);

  useEffect(() => {
    fetchConfig();
    fetchDiagnostics();
  }, [fetchConfig, fetchDiagnostics]);

  const handleCopy = async (label: string, value: string) => {
    const ok = await copyToClipboard(value);
    setCopied(ok ? label : null);
    window.setTimeout(() => setCopied(null), 1200);
  };

  const handleToggleEnabled = async () => {
    if (!config) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase
      .from("client_lead_ingest_configs")
      .update({ enabled: !config.enabled })
      .eq("client_id", clientId);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    await fetchConfig();
    setBusy(false);
  };

  const handleSaveOrigins = async () => {
    setBusy(true);
    setError(null);

    const arr = originsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const { error } = await supabase
      .from("client_lead_ingest_configs")
      .update({ allowed_origins: arr.length > 0 ? arr : null })
      .eq("client_id", clientId);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    await fetchConfig();
    setBusy(false);
  };

  const handleRotateKey = async () => {
    if (!window.confirm("Rotate this client's lead ingest key? All sites using the old key must be updated.")) {
      return;
    }

    setBusy(true);
    setError(null);

    const { data, error } = await supabase.functions.invoke("rotate-lead-ingest-key", {
      body: { client_id: clientId },
    });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (parsed?.error) {
      setError(parsed.error);
      setBusy(false);
      return;
    }

    await fetchConfig();
    setShowKey(true);
    setBusy(false);
  };

  if (!config) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
        {error ? `Error: ${error}` : "No lead ingestion configuration found for this client."}
      </div>
    );
  }

  const keyToShow = showKey ? config.ingest_key : maskKey(config.ingest_key);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
        <ShieldCheck className="w-5 h-5 text-indigo-600" /> Leads API (Admin)
      </h2>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Endpoint</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="text-xs sm:text-sm font-mono text-slate-900 break-all">{endpoint}</code>
            <button
              onClick={() => handleCopy("endpoint", endpoint)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Copy endpoint"
            >
              <Copy className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client ID</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="text-xs sm:text-sm font-mono text-slate-900 break-all">{clientId}</code>
            <button
              onClick={() => handleCopy("client_id", clientId)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Copy client id"
            >
              <Copy className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Ingest Key
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="text-xs sm:text-sm font-mono text-slate-900 break-all">{keyToShow}</code>
            <button
              onClick={() => setShowKey((v) => !v)}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
              title={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleCopy("ingest_key", config.ingest_key)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Copy ingest key"
            >
              <Copy className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5" />
            Keep this key private. Rotate it immediately if you suspect exposure.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleToggleEnabled}
            disabled={busy}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors border disabled:opacity-50 ${
              config.enabled
                ? "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {config.enabled ? "Disable Ingestion" : "Enable Ingestion"}
          </button>

          <button
            onClick={handleRotateKey}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            Rotate Key
          </button>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4" /> Allowed Origins
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Optional domain allow-list (comma-separated). Requests must include a matching Origin header.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
              value={originsText}
              onChange={(e) => setOriginsText(e.target.value)}
              placeholder="https://example.com, https://www.example.com"
            />
            <button
              onClick={handleSaveOrigins}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Diagnostics</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold">Active</p>
              <p className="text-lg font-bold text-slate-900">{activeCount} / 50</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total</p>
              <p className="text-lg font-bold text-slate-900">{totalCount}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold">Last Lead</p>
              <p className="text-sm font-semibold text-slate-900">{lastLeadAt ? new Date(lastLeadAt).toLocaleString() : "—"}</p>
            </div>
          </div>
          {activeCount >= 50 && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Limit reached. New leads will be blocked until some are resolved/archived.
            </div>
          )}
        </div>

        {copied && <div className="text-xs text-emerald-700 font-semibold">Copied {copied}.</div>}
      </div>
    </div>
  );
}