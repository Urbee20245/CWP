"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import {
  Loader2, Globe, Mail, Phone, Clock, AlertTriangle, RefreshCw,
  ChevronDown, ChevronRight, Tag, Calendar, Zap,
} from "lucide-react";
import { format } from "date-fns";

interface StaticSiteLead {
  id: string;
  client_id: string;
  client_slug: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  topic: string | null;
  timeline: string | null;
  priority_score: number | null;
  future_date: string | null;
  message: string | null;
  source: string | null;
  page_url: string | null;
  created_at: string;
}

function priorityBadge(score: number | null) {
  if (score === null) return null;
  const color =
    score >= 8 ? "bg-red-100 text-red-700 border-red-200" :
    score >= 5 ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      <Zap className="w-3 h-3" />
      Priority {score}/10
    </span>
  );
}

export default function StaticSiteLeadsPanel({ clientId }: { clientId: string }) {
  const [leads, setLeads] = useState<StaticSiteLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("static_site_leads")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (err) {
      setError(err.message);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading static site leads…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-600" />
          Static Site Leads
          {leads.length > 0 && (
            <span className="ml-1 text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {leads.length}
            </span>
          )}
        </h2>
        <button
          onClick={fetchLeads}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {leads.length === 0 && !error && (
        <p className="text-sm text-slate-400 italic">
          No leads from the static site yet. They'll appear here as soon as the contact form is submitted.
        </p>
      )}

      <div className="space-y-3">
        {leads.map(lead => {
          const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
          const isOpen = expanded[lead.id] ?? false;

          return (
            <div key={lead.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Header row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpand(lead.id)}
              >
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{name}</span>
                    {lead.email && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" />{lead.email}
                      </span>
                    )}
                    {lead.phone && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{lead.phone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {lead.topic && (
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Tag className="w-3 h-3" />{lead.topic}
                      </span>
                    )}
                    {priorityBadge(lead.priority_score)}
                    <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      {format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {lead.timeline && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Timeline
                        </p>
                        <p className="mt-0.5 text-slate-900">{lead.timeline}</p>
                      </div>
                    )}
                    {lead.future_date && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Date</p>
                        <p className="mt-0.5 text-slate-900">{lead.future_date}</p>
                      </div>
                    )}
                    {lead.source && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</p>
                        <p className="mt-0.5 text-slate-900">{lead.source}</p>
                      </div>
                    )}
                    {lead.page_url && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Page URL</p>
                        <a
                          href={lead.page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 text-indigo-600 underline text-xs break-all"
                        >
                          {lead.page_url}
                        </a>
                      </div>
                    )}
                  </div>
                  {lead.message && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Message</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-white border border-slate-200 rounded-lg p-3">
                        {lead.message}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
