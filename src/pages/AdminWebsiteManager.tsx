"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  Globe, Eye, Edit3, ToggleLeft, ToggleRight, Trash2,
  Copy, CheckCircle, Clock, AlertTriangle, Loader2, Search, Plus,
  Upload, Wand2, FileCode2, RefreshCw,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface SiteRow {
  id: string;
  client_id: string;
  client_slug: string | null;
  business_name: string;
  site_type: 'cwp' | 'static' | 'raw_html' | null;
  generation_status: 'draft' | 'generating' | 'complete' | 'error' | null;
  generation_error: string | null;
  is_published: boolean;
  custom_domain: string | null;
  primary_color: string | null;
  updated_at: string;
  premium_features: string[];
}

type FilterStatus = 'all' | 'live' | 'draft' | 'building' | 'error';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function siteUrl(site: SiteRow): string {
  if (site.custom_domain) return `https://${site.custom_domain}`;
  if (site.client_slug) return `${window.location.origin}/site/${site.client_slug}`;
  return '';
}

export default function AdminWebsiteManager() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SiteRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadSites = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('website_briefs')
      .select(`
        id, client_id, client_slug, business_name, site_type,
        generation_status, generation_error, is_published,
        custom_domain, primary_color, updated_at, premium_features
      `)
      .order('updated_at', { ascending: false });
    setSites((data as SiteRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadSites(); }, [loadSites]);

  const togglePublish = async (site: SiteRow) => {
    setTogglingId(site.id);
    await supabase
      .from('website_briefs')
      .update({ is_published: !site.is_published })
      .eq('id', site.id);
    setSites(prev => prev.map(s => s.id === site.id ? { ...s, is_published: !s.is_published } : s));
    setTogglingId(null);
  };

  const deleteSite = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    await supabase.from('website_briefs').delete().eq('id', confirmDelete.id);
    setSites(prev => prev.filter(s => s.id !== confirmDelete.id));
    setConfirmDelete(null);
    setDeletingId(null);
  };

  const copyUrl = (site: SiteRow) => {
    const url = siteUrl(site);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(site.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = sites.filter(s => {
    const matchSearch = s.business_name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'live') return s.is_published;
    if (filter === 'draft') return !s.is_published && s.generation_status !== 'generating' && s.generation_status !== 'error';
    if (filter === 'building') return s.generation_status === 'generating';
    if (filter === 'error') return s.generation_status === 'error';
    return true;
  });

  const stats = {
    total: sites.length,
    live: sites.filter(s => s.is_published).length,
    draft: sites.filter(s => !s.is_published && s.generation_status === 'complete').length,
    building: sites.filter(s => s.generation_status === 'generating').length,
    error: sites.filter(s => s.generation_status === 'error').length,
  };

  function SiteTypeBadge({ type }: { type: SiteRow['site_type'] }) {
    const map = {
      cwp:      { label: 'CWP Builder',   cls: 'bg-indigo-100 text-indigo-700',   icon: <Wand2 className="w-3 h-3" /> },
      static:   { label: 'Static Upload', cls: 'bg-violet-100 text-violet-700',   icon: <Upload className="w-3 h-3" /> },
      raw_html: { label: 'Pixel Clone',   cls: 'bg-emerald-100 text-emerald-700', icon: <FileCode2 className="w-3 h-3" /> },
    };
    const t = map[type as keyof typeof map] || { label: 'Unknown', cls: 'bg-slate-100 text-slate-600', icon: <Globe className="w-3 h-3" /> };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.cls}`}>
        {t.icon} {t.label}
      </span>
    );
  }

  function StatusBadge({ site }: { site: SiteRow }) {
    if (site.generation_status === 'generating')
      return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Loader2 className="w-3 h-3 animate-spin" />Building…</span>;
    if (site.generation_status === 'error')
      return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" />Error</span>;
    if (site.is_published)
      return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />Live</span>;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600"><Clock className="w-3 h-3" />Draft</span>;
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Globe className="w-8 h-8 text-indigo-600" />
              Website Manager
            </h1>
            <p className="text-slate-500 mt-1">All websites built and hosted on CWP</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/admin/site-import')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" /> Import Site
            </button>
            <button
              onClick={() => navigate('/admin/website-builder')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Site
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Sites',  value: stats.total,    color: 'text-slate-700',   bg: 'bg-slate-50   border-slate-200'   },
            { label: 'Live',         value: stats.live,     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Draft',        value: stats.draft,    color: 'text-slate-600',   bg: 'bg-slate-50   border-slate-200'   },
            { label: 'Building',     value: stats.building, color: 'text-amber-700',   bg: 'bg-amber-50   border-amber-200'   },
            { label: 'Error',        value: stats.error,    color: 'text-red-700',     bg: 'bg-red-50     border-red-200'     },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search sites..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['all','live','draft','building','error'] as FilterStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  filter === f ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button onClick={loadSites} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Sites Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <Globe className="w-14 h-14 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-600 font-semibold text-lg">
              {search || filter !== 'all' ? 'No sites match your filter' : 'No websites yet'}
            </p>
            <p className="text-slate-400 text-sm mt-1 mb-6">
              {search || filter !== 'all' ? 'Try adjusting your search or filter.' : 'Build or import your first client site to get started.'}
            </p>
            {!search && filter === 'all' && (
              <button
                onClick={() => navigate('/admin/website-builder')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Build First Site
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(site => {
              const url = siteUrl(site);
              const isToggling = togglingId === site.id;
              const isCopied = copiedId === site.id;

              return (
                <div
                  key={site.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                >
                  {/* Color bar */}
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: site.primary_color || '#4F46E5' }}
                  />

                  <div className="p-5 flex-1 flex flex-col gap-3">

                    {/* Top row: name + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                          {site.business_name}
                        </h3>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-500 hover:text-indigo-700 truncate block mt-0.5 font-mono"
                          >
                            {site.custom_domain || `/site/${site.client_slug}`}
                          </a>
                        )}
                      </div>
                      <StatusBadge site={site} />
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <SiteTypeBadge type={site.site_type} />
                      {site.premium_features?.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          ✨ {site.premium_features.length} add-on{site.premium_features.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Error message */}
                    {site.generation_status === 'error' && site.generation_error && (
                      <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100 truncate">
                        {site.generation_error}
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-slate-400 mt-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Updated {timeAgo(site.updated_at)}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">

                      {/* Preview */}
                      <a
                        href={url ? `${url}?preview=1` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </a>

                      {/* Edit — only for CWP builder sites */}
                      {site.site_type === 'cwp' && (
                        <button
                          onClick={() => navigate(`/admin/website-builder?client=${site.client_id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}

                      {/* Upload new version — for static sites */}
                      {(site.site_type === 'static' || site.site_type === 'raw_html') && (
                        <button
                          onClick={() => navigate(`/admin/site-import?client=${site.client_id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                          title="Upload new version"
                        >
                          <Upload className="w-3.5 h-3.5" /> Update
                        </button>
                      )}

                      {/* Copy URL */}
                      <button
                        onClick={() => copyUrl(site)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                        title="Copy URL"
                      >
                        {isCopied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* Publish toggle */}
                      <button
                        onClick={() => togglePublish(site)}
                        disabled={isToggling || site.generation_status === 'generating'}
                        className={`p-2 rounded-xl border transition-colors ${
                          site.is_published
                            ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                        title={site.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {isToggling
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : site.is_published
                          ? <ToggleRight className="w-3.5 h-3.5" />
                          : <ToggleLeft className="w-3.5 h-3.5" />
                        }
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setConfirmDelete(site)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                        title="Delete site"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete site?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  This permanently deletes <strong>{confirmDelete.business_name}</strong>'s website. Cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingId}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteSite}
                disabled={!!deletingId}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
