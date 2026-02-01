"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ClientLayout from "../components/ClientLayout";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { CheckCircle2, ClipboardList, Loader2, Phone, Mail, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type LeadStatus = "new" | "contacted" | "resolved";

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: LeadStatus;
  created_at: string;
};

const STATUS_STYLES: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  contacted: { label: "Contacted", className: "bg-amber-50 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function ClientLeads() {
  const { profile, isLoading: isAuthLoading } = useAuth();

  const [clientId, setClientId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingId, setIsSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "resolved">("active");

  const activeCount = useMemo(
    () => leads.filter((l) => l.status !== "resolved").length,
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
      .select("id, name, email, phone, message, status, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .range(0, 199);

    if (leadsErr) {
      setError(leadsErr.message);
      setIsLoading(false);
      return;
    }

    setLeads((leadsData as any) || []);
    setIsLoading(false);
  }, [profile]);

  useEffect(() => {
    if (profile) fetchClientAndLeads();
  }, [profile, fetchClientAndLeads]);

  const updateLeadStatus = async (leadId: string, status: LeadStatus) => {
    setIsSavingId(leadId);
    setError(null);

    const { error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", leadId);

    if (error) {
      setError(error.message);
      setIsSavingId(null);
      return;
    }

    // Optimistic refresh
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    setIsSavingId(null);
  };

  const visibleLeads = useMemo(() => {
    if (view === "active") return leads.filter((l) => l.status !== "resolved");
    return leads.filter((l) => l.status === "resolved");
  }, [leads, view]);

  if (isAuthLoading || isLoading) {
    return (
      <ClientLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-indigo-600" /> Leads
            </h1>
            <p className="text-slate-600 mt-2">
              View and manage leads submitted from your website forms.
            </p>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {error && (
          <div className="p-3 mb-6 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="p-4 mb-6 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Active leads:</span> {activeCount} / 50
          </div>
          {activeCount >= 50 && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              You’ve reached the 50 active lead limit. New leads will be blocked until you resolve some.
            </div>
          )}
        </div>

        {visibleLeads.length === 0 ? (
          <div className="p-10 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-600">
            No {view === "active" ? "active" : "resolved"} leads yet.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleLeads.map((lead) => {
              const s = STATUS_STYLES[lead.status];
              return (
                <div
                  key={lead.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-slate-900 truncate">
                          {lead.name || "(No name)"}
                        </h3>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s.className}`}>
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

        {/* small footer hint */}
        {clientId && (
          <p className="mt-8 text-xs text-slate-500">
            Leads are securely isolated to your account. If you need help connecting your website form, visit Settings → Leads API.
          </p>
        )}
      </div>
    </ClientLayout>
  );
}
