"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { Copy, KeyRound, Loader2, ShieldCheck, RotateCw, Info } from "lucide-react";

type LeadIngestConfig = {
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

export default function ClientLeadIngestion({ clientId }: { clientId: string }) {
  const [config, setConfig] = useState<LeadIngestConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const endpoint = useMemo(
    () => "https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/ingest-lead",
    []
  );

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("client_lead_ingest_configs")
      .select("client_id, ingest_key, enabled, allowed_origins, updated_at")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setConfig(null);
      setIsLoading(false);
      return;
    }

    setConfig((data as any) || null);
    setIsLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleCopy = async (label: string, value: string) => {
    const ok = await copyToClipboard(value);
    setCopied(ok ? label : null);
    window.setTimeout(() => setCopied(null), 1200);
  };

  const handleToggleEnabled = async () => {
    if (!config) return;
    setIsBusy(true);
    setError(null);
    const { error } = await supabase
      .from("client_lead_ingest_configs")
      .update({ enabled: !config.enabled })
      .eq("client_id", clientId);

    if (error) {
      setError(error.message);
      setIsBusy(false);
      return;
    }

    await fetchConfig();
    setIsBusy(false);
  };

  const handleRotateKey = async () => {
    if (!window.confirm("Rotate your lead ingest key? Any websites using the old key will stop working until updated.")) {
      return;
    }

    setIsBusy(true);
    setError(null);

    const { data, error } = await supabase.functions.invoke("rotate-lead-ingest-key", {
      body: { client_id: clientId },
    });

    if (error) {
      setError(error.message);
      setIsBusy(false);
      return;
    }

    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (parsed?.error) {
      setError(parsed.error);
      setIsBusy(false);
      return;
    }

    await fetchConfig();
    setShowKey(true);
    setIsBusy(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
        No lead ingestion configuration found for this account.
      </div>
    );
  }

  const keyToShow = showKey ? config.ingest_key : maskKey(config.ingest_key);

  const sample = `fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    client_id: "${clientId}",
    ingest_key: "${config.ingest_key}",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 555-123-4567",
    message: "Hi — I'm interested in a quote.",
    source: "website-contact-form",
    page_url: window.location.href,
    referrer: document.referrer,
  }),
});`;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
        <ShieldCheck className="w-5 h-5 text-indigo-600" /> Leads API (Multi-Website)
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
              {showKey ? "Hide" : "Show"}
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
            This key should be kept private (store it server-side if possible). If exposed, rotate it.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleToggleEnabled}
            disabled={isBusy}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors border disabled:opacity-50 ${
              config.enabled
                ? "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
            }`}
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {config.enabled ? "Disable Ingestion" : "Enable Ingestion"}
          </button>

          <button
            onClick={handleRotateKey}
            disabled={isBusy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            Rotate Key
          </button>
        </div>

        {copied && (
          <div className="text-xs text-emerald-700 font-semibold">Copied {copied}.</div>
        )}

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sample submission (JavaScript)</p>
          <pre className="mt-2 text-[11px] leading-relaxed bg-white border border-slate-200 rounded-lg p-3 overflow-auto">
            <code>{sample}</code>
          </pre>
          <p className="text-xs text-slate-500 mt-2">
            Tip: This endpoint is shared across all clients; your <span className="font-mono">client_id</span> + <span className="font-mono">ingest_key</span> routes the lead to the right account.
          </p>
        </div>
      </div>
    </div>
  );
}
