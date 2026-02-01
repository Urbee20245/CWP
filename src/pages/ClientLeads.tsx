"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ClientLayout from "../components/ClientLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  Mail,
  Phone,
  Clock,
  AlertTriangle,
  Archive,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

type LeadStatus = "new" | "contacted" | "resolved" | "archived";

type LeadRow = {
  id: string;
  client_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: LeadStatus;
  source: string | null;
  page_url: string | null;
  referrer: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_STYLES: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  contacted: { label: "Contacted", className: "bg-amber-50 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  archived: { label: "Archived", className: "bg-slate-50 text-slate-700 border-slate-200" },
};

function csvEscape(v: unknown) {
  const s = (v ?? "").toString();
  const needsQuotes = /[\n\r,\"]/g.test(s);
  const escaped = s.replace(/\"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ClientLeads() {
  const { profile, isLoading: isAuthLoading } = useAuth();

  const [clientId, setClientId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingId, setIsSavingId] = useState<string | null>(null);
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "resolved" | "archived">("active");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const activeCount = useMemo(
    () => leads.filter((l) => l.status !== "resolved" && l.status !== "archived").length,
    [leads]
  );

  const fetchClientAndLeads = useCallback(async () => {
    if (!profile) return;

    setIsLoading(true);
    setError(null);

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_profile_id", profile.id)
      .maybeSingle();

    if (clientErr) {
      setError(clientErr.message);
      setIsLoading(false);
      return;
    }

    if (!client?.id) {
      setError("Client record not found for this user.");
      setIsLoading(false);
      return;
    }

    setClientId(client.id);

    const { data: leadsData, error: leadsErr } = await supabase
      .from("leads")
      .select(
        "id, client_id, name, email, phone, message, status, source, page_url, referrer, created_at, updated_at"
      )
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .range(0, 499);

    if (leadsErr) {
      setError(leadsErr.message);
      setIsLoading(false);
      return;
    }

    setLeads((leadsData as any) || []);
    setSelectedIds({});
    setIsLoading(false);
  }, [profile]);

  useEffect(() => {
    if (profile) fetchClientAndLeads();
  }, [profile, fetchClientAndLeads]);

  const visibleLeads = useMemo(() => {
    if (view === "active") return leads.filter((l) => l.status !== "resolved" && l.status !== "archived");
    if (view === "resolved") return leads.filter((l) => l.status === "resolved");
    return leads.filter((l) => l.status === "archived");
  }, [leads, view]);

  const selectedLeadIds = useMemo(() => {
    return Object.keys(selectedIds).filter((id) => selectedIds[id]);
  }, [selectedIds]);

  const allVisibleSelected = useMemo(() => {
    if (visibleLeads.length === 0) return false;
    return visibleLeads.every((l) => selectedIds[l.id]);
  }, [visibleLeads, selectedIds]);

  const toggleSelectAllVisible = () => {
    if (visibleLeads.length === 0) return;
    const next: Record<string, boolean> = { ...selectedIds };
    const to = !allVisibleSelected;
    for (const l of visibleLeads) next[l.id] = to;
    setSelectedIds(next);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateLeadStatus = async (leadId: string, status: LeadStatus) => {
    setIsSavingId(leadId);
    setError(null);

    const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);

    if (error) {
      setError(error.message);
      setIsSavingId(null);
      return;
    }

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    setIsSavingId(null);
  };

  const exportCsv = (rows: LeadRow[]) => {
    const header = [
      "id",
      "client_id",
      "name",
      "email",
      "phone",
      "message",
      "status",
      "source",
      "page_url",
      "referrer",
      "created_at",
      "updated_at",
    ];

    const lines = [header.join(",")];

    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.client_id,
          r.name,
          r.email,
          r.phone,
          r.message,
          r.status,
          r.source,
          r.page_url,
          r.referrer,
          r.created_at,
          r.updated_at,
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`leads-${view}-${stamp}.csv`, lines.join("\n"));
  };

  const handleExport = () => {
    const ids = selectedLeadIds;
    const rows = ids.length > 0 ? leads.filter((l) => ids.includes(l.id)) : visibleLeads;
    if (rows.length === 0) return;
    exportCsv(rows);
  };

  const bulkUpdateStatus = async (status: LeadStatus) => {
    if (selectedLeadIds.length === 0) return;

    setIsBulkBusy(true);
    setError(null);

    const ids = selectedLeadIds;
    const { error } = await supabase.from("leads").update({ status }).in("id", ids);

    if (error) {
      setError(error.message);
      setIsBulkBusy(false);
      return;
    }

    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, status } : l)));
    setSelectedIds({});
    setIsBulkBusy(false);
  };

  const bulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;

    const ok = window.confirm(
      `Delete ${selectedLeadIds.length} lead(s)? This cannot be undone. (Tip: use Archive if you just want to clear the limit.)`
    );
    if (!ok) return;

    setIsBulkBusy(true);
    setError(null);

    const ids = selectedLeadIds;
    const { error } = await supabase.from("leads").delete().in("id", ids);

    if (error) {
      setError(error.message);
      setIsBulkBusy(false);
      return;
    }

    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    setSelectedIds({});
    setIsBulkBusy(false);
  };

  if (isAuthLoading || isLoading) {
    return (
      <ClientLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </ClientLayout>
    );
  }

  const selectedCount = selectedLeadIds.length;

  return (
    <ClientLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-indigo-600" /> Leads
            </h1>
            <p className="text-slate-600 mt-2">
              Export your leads as CSV and clear them (archive/delete) to stay under the 50 active lead limit.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setView("active")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                view === "active"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setView("resolved")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                view === "resolved"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Resolved
            </button>
            <button
              onClick={() => setView("archived")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                view === "archived"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Archived
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-6 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="p-4 mb-6 bg-white border border-slate-200 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Active leads:</span> {activeCount} / 50
            </div>
            {activeCount >= 50 && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Limit reached. Export and archive/delete some leads to receive new ones.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
              title={selectedCount > 0 ? "Exports selected leads" : "Exports all leads in the current view"}
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>

            <button
              onClick={() => fetchClientAndLeads()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>

            <button
              disabled={selectedCount === 0 || isBulkBusy}
              onClick={() => bulkUpdateStatus("archived")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              title="Archive selected leads (removes them from the active limit)"
            >
              {isBulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archive ({selectedCount})
            </button>

            <button
              disabled={selectedCount === 0 || isBulkBusy}
              onClick={bulkDelete}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              title="Delete selected leads (permanent)"
            >
              {isBulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete ({selectedCount})
            </button>
          </div>
        </div>

        {visibleLeads.length === 0 ? (
          <div className="p-10 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-600">
            No {view} leads yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-sm text-slate-700 flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Select all in view ({visibleLeads.length})
              </label>
              {selectedCount > 0 && (
                <div className="text-xs text-slate-500">Selected: {selectedCount}</div>
              )}
            </div>

            {visibleLeads.map((lead) => {
              const s = STATUS_STYLES[lead.status] || STATUS_STYLES.new;
              return (
                <div
                  key={lead.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0 flex gap-3">
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={!!selectedIds[lead.id]}
                          onChange={() => toggleSelected(lead.id)}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label="Select lead"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-slate-900 truncate">
                            {lead.name || "(No name)"}
                          </h3>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s.className}`}
                          >
                            {s.label}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              className="inline-flex items-center gap-2 hover:text-indigo-700"
                            >
                              <Mail className="w-4 h-4 text-slate-500" /> {lead.email}
                            </a>
                          )}
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="inline-flex items-center gap-2 hover:text-indigo-700"
                            >
                              <Phone className="w-4 h-4 text-slate-500" /> {lead.phone}
                            </a>
                          )}
                          <span className="inline-flex items-center gap-2 text-slate-500">
                            <Clock className="w-4 h-4" />
                            {format(new Date(lead.created_at), "MMM dd, yyyy h:mm a")}
                          </span>
                        </div>

                        {lead.message && (
                          <p className="mt-3 text-sm text-slate-600 whitespace-pre-wrap">
                            {lead.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                      {lead.status !== "contacted" && lead.status !== "resolved" && (
                        <button
                          onClick={() => updateLeadStatus(lead.id, "contacted")}
                          disabled={isSavingId === lead.id}
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
                        >
                          {isSavingId === lead.id ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Saving
                            </span>
                          ) : (
                            "Mark Contacted"
                          )}
                        </button>
                      )}

                      {lead.status !== "resolved" && (
                        <button
                          onClick={() => updateLeadStatus(lead.id, "resolved")}
                          disabled={isSavingId === lead.id}
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                          {isSavingId === lead.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Saving
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Resolve
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {clientId && (
          <p className="mt-8 text-xs text-slate-500">
            Exported CSV is downloaded locally. Archived and resolved leads do not count toward the 50 active lead limit.
          </p>
        )}
      </div>
    </ClientLayout>
  );
}