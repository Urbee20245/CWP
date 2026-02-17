"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ClientLayout from '../components/ClientLayout';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import { useAuth } from '../hooks/useAuth';
import { WebsiteBrief, WebsiteEdit } from '../types/website';
import {
  Globe, Loader2, Eye, Save, Lock, CheckCircle, AlertTriangle,
  ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react';

function getByPath(obj: any, path: string): any {
  return path.split(/[\.\[\]]+/).filter(Boolean).reduce((acc, key) => {
    if (acc === null || acc === undefined) return '';
    return acc[isNaN(Number(key)) ? key : Number(key)];
  }, obj);
}

function labelFromPath(path: string): string {
  const last = path.split(/[\.\[\]]+/).filter(Boolean).pop() || path;
  return last
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, c => c.toUpperCase());
}

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero Section',
  services: 'Services',
  about: 'About Us',
  social_proof: 'Reviews & Testimonials',
  contact_cta: 'Contact Info',
  faq: 'FAQs',
  stats: 'Stats',
  gallery: 'Gallery',
  pricing_cards: 'Pricing',
  blog_preview: 'Blog',
};

const ClientWebsite: React.FC = () => {
  const { profile } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [brief, setBrief] = useState<WebsiteBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_profile_id', profile.id)
        .single();

      if (!clientData) { setLoading(false); return; }
      setClientId(clientData.id);

      const { data: briefData } = await supabase
        .from('website_briefs')
        .select('*')
        .eq('client_id', clientData.id)
        .maybeSingle();

      if (briefData) {
        setBrief(briefData as WebsiteBrief);
        const initialEdits: Record<string, string> = {};
        if (briefData.website_json) {
          for (const page of briefData.website_json.pages || []) {
            for (const section of page.sections || []) {
              for (const path of section.editable_fields || []) {
                initialEdits[path] = String(getByPath(section, path) ?? '');
              }
            }
          }
          if (briefData.website_json.global?.phone !== undefined) {
            initialEdits['global.phone'] = briefData.website_json.global.phone;
          }
          if (briefData.website_json.global?.address !== undefined) {
            initialEdits['global.address'] = briefData.website_json.global.address;
          }
        }
        setEdits(initialEdits);
        if (briefData.website_json?.pages?.length > 0) {
          setExpandedPages({ [briefData.website_json.pages[0].id]: true });
        }
      }
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  const handleSave = async () => {
    if (!clientId || !brief) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const editArray: WebsiteEdit[] = Object.entries(edits).map(([field_path, new_value]) => ({
      field_path,
      new_value,
    }));
    try {
      await AdminService.saveWebsiteEdits(clientId, editArray);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = brief?.client_slug ? `/site/${brief.client_slug}` : null;

  return (
    <ClientLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-6 h-6 text-indigo-600" />
              My Website
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Update your business info below. Design decisions are managed by your account team.
            </p>
          </div>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors">
              <Eye className="w-4 h-4" /> Preview Site <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : !brief ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Your website is being built</h2>
            <p className="text-slate-400 text-sm">Our team is working on your website. Check back soon!</p>
          </div>
        ) : brief.generation_status === 'generating' || brief.generation_status === 'draft' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-amber-800">Your website is being designed...</p>
            <p className="text-amber-600 text-sm mt-1">This won't take long. Refresh in a moment.</p>
          </div>
        ) : brief.generation_status === 'error' ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-10 text-center">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="font-semibold text-red-800">There was an issue building your website</p>
            <p className="text-red-500 text-sm mt-1">Please contact your account team for assistance.</p>
          </div>
        ) : brief.generation_status === 'complete' && brief.website_json ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${brief.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {brief.is_published ? '● Live' : '● Draft'}
              </span>
              {brief.client_slug && <span className="text-sm text-slate-400 font-mono">/site/{brief.client_slug}</span>}
              <span className="text-xs text-slate-400">{brief.website_json.pages.length} page{brief.website_json.pages.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-3">
              {brief.website_json.pages.map((page) => {
                const isExpanded = expandedPages[page.id] ?? false;
                const pageEditableFields: Array<{ path: string }> = [];
                for (const section of page.sections) {
                  for (const path of section.editable_fields) {
                    pageEditableFields.push({ path });
                  }
                }

                return (
                  <div key={page.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedPages(prev => ({ ...prev, [page.id]: !isExpanded }))}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{page.name}</span>
                          <span className="text-xs text-slate-400 font-mono">{page.slug ? `/${page.slug}` : '/'}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {pageEditableFields.length > 0
                            ? `${pageEditableFields.length} editable field${pageEditableFields.length !== 1 ? 's' : ''}`
                            : 'Managed by your design team'}
                        </p>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 p-5">
                        {pageEditableFields.length === 0 ? (
                          <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                            <Lock className="w-4 h-4" />
                            This page's content is managed by your design team.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {pageEditableFields.map(({ path }) => {
                              const isLong = String(edits[path] || '').length > 80;
                              return (
                                <div key={path}>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">{labelFromPath(path)}</label>
                                  {isLong ? (
                                    <textarea
                                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                      rows={3}
                                      value={edits[path] ?? ''}
                                      onChange={e => setEdits(prev => ({ ...prev, [path]: e.target.value }))}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      value={edits[path] ?? ''}
                                      onChange={e => setEdits(prev => ({ ...prev, [path]: e.target.value }))}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Global: phone + address */}
              {(edits['global.phone'] !== undefined || edits['global.address'] !== undefined) && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="font-semibold text-slate-800 mb-4">Business Details</h3>
                  <div className="space-y-4">
                    {['global.phone', 'global.address'].map(path =>
                      edits[path] !== undefined ? (
                        <div key={path}>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{labelFromPath(path)}</label>
                          <input
                            type="text"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={edits[path] ?? ''}
                            onChange={e => setEdits(prev => ({ ...prev, [path]: e.target.value }))}
                          />
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              <div className="sticky bottom-4 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    : saveSuccess ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                    : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
                {saveError && <p className="text-red-500 text-sm text-center mt-2">{saveError}</p>}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </ClientLayout>
  );
};

export default ClientWebsite;
