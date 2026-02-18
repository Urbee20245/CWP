// CustomDomainAdmin — Client back-office accessible at /back-office on their custom domain.
// Handles its own Supabase email+password auth. After login, verifies the user's client
// record matches the current hostname so clients can only see their own site.

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';
import {
  Globe, Loader2, LogOut, CheckCircle, AlertTriangle, Save,
  Lock, ChevronDown, ChevronRight, MessageSquare, Eye, EyeOff,
  User, Mail,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SiteGlobal {
  business_name: string;
  primary_color: string;
  font_heading: string;
  logo_url?: string;
}

interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string;
  source: string | null;
  created_at: string;
}

// ── Helper: resolve editable fields from website_json ────────────────────────

function getByPath(obj: any, path: string): any {
  return path.split(/[\.\[\]]+/).filter(Boolean).reduce((acc, key) => {
    if (acc == null) return '';
    return acc[isNaN(Number(key)) ? key : Number(key)];
  }, obj);
}

function labelFromPath(path: string): string {
  const last = path.split(/[\.\[\]]+/).filter(Boolean).pop() || path;
  return last.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase());
}

// ── Login screen ─────────────────────────────────────────────────────────────

const LoginScreen: React.FC<{
  primaryColor: string;
  businessName: string;
  logoUrl?: string;
  onLogin: (email: string, password: string) => Promise<string | null>;
}> = ({ primaryColor, businessName, logoUrl, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const err = await onLogin(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          {logoUrl
            ? <img src={logoUrl} alt={businessName} className="h-12 w-auto mx-auto mb-4 object-contain" />
            : <Globe className="w-12 h-12 mx-auto mb-4" style={{ color: primaryColor }} />}
          <h1 className="text-2xl font-bold text-slate-900">{businessName}</h1>
          <p className="text-slate-500 text-sm mt-1">Back Office Login</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

type AuthState = 'loading' | 'unauthenticated' | 'checking' | 'authorized' | 'unauthorized';

const CustomDomainAdmin: React.FC = () => {
  const hostname = window.location.hostname;

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [clientId, setClientId] = useState<string | null>(null);
  const [siteGlobal, setSiteGlobal] = useState<SiteGlobal>({
    business_name: '',
    primary_color: '#4F46E5',
    font_heading: 'Inter',
  });
  const [briefJson, setBriefJson] = useState<any>(null);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<'content' | 'leads'>('content');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // ── Auth check after login / on mount ──────────────────────────────────────

  const verifyAndLoad = useCallback(async () => {
    setAuthState('checking');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAuthState('unauthenticated'); return; }

    // Get the client record for this user
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_profile_id', user.id)
      .maybeSingle();

    if (!clientData) { setAuthState('unauthorized'); return; }

    // Verify that this client's website is mapped to the current hostname
    const { data: brief } = await supabase
      .from('website_briefs')
      .select('client_id, website_json, is_published')
      .eq('client_id', clientData.id)
      .eq('custom_domain', hostname)
      .maybeSingle();

    if (!brief) { setAuthState('unauthorized'); return; }

    setClientId(clientData.id);

    const g = (brief.website_json as any)?.global;
    setSiteGlobal({
      business_name: g?.business_name || '',
      primary_color: g?.primary_color || '#4F46E5',
      font_heading: g?.font_heading || 'Inter',
      logo_url: g?.logo_url,
    });
    setBriefJson(brief.website_json);

    // Pre-populate content edits
    const initialEdits: Record<string, string> = {};
    const json = brief.website_json as any;
    if (json?.pages) {
      for (const page of json.pages) {
        for (const section of page.sections || []) {
          for (const path of section.editable_fields || []) {
            initialEdits[path] = String(getByPath(section, path) ?? '');
          }
        }
      }
      if (json.global?.phone != null) initialEdits['global.phone'] = json.global.phone;
      if (json.global?.address != null) initialEdits['global.address'] = json.global.address;
      if (json.pages.length > 0) setExpandedPages({ [json.pages[0].id]: true });
    }
    setEdits(initialEdits);

    setAuthState('authorized');
  }, [hostname]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        verifyAndLoad();
      } else {
        setAuthState('unauthenticated');
      }
    });
  }, [verifyAndLoad]);

  // ── Load leads when switching to leads tab ─────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'leads' || !clientId) return;
    setLeadsLoading(true);
    supabase
      .from('leads')
      .select('id, name, email, phone, message, status, source, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setLeads(data || []);
        setLeadsLoading(false);
      });
  }, [activeTab, clientId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogin = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    await verifyAndLoad();
    return null;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthState('unauthenticated');
  };

  const handleSaveContent = async () => {
    if (!clientId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const editArray = Object.entries(edits).map(([field_path, new_value]) => ({ field_path, new_value }));
    try {
      await AdminService.saveWebsiteEdits(clientId, editArray);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const markLeadStatus = async (leadId: string, status: string) => {
    await supabase.from('leads').update({ status }).eq('id', leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
  };

  const c = siteGlobal.primary_color;

  // ── Render states ─────────────────────────────────────────────────────────

  if (authState === 'loading' || authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <LoginScreen
        primaryColor={c}
        businessName={siteGlobal.business_name || window.location.hostname}
        logoUrl={siteGlobal.logo_url}
        onLogin={handleLogin}
      />
    );
  }

  if (authState === 'unauthorized') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h1>
        <p className="text-slate-500 text-sm mb-6">Your account is not linked to this website.</p>
        <button onClick={handleSignOut} className="text-sm text-indigo-600 hover:underline">
          Sign out and try a different account
        </button>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  const pages = briefJson?.pages || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {siteGlobal.logo_url
              ? <img src={siteGlobal.logo_url} alt="" className="h-7 w-auto object-contain" />
              : <Globe className="w-5 h-5" style={{ color: c }} />}
            <span className="font-semibold text-slate-800 text-sm">{siteGlobal.business_name}</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-mono">/ Back Office</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-8 w-fit">
          {(['content', 'leads'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={
                activeTab === tab
                  ? { backgroundColor: c, color: '#ffffff' }
                  : { color: '#64748b' }
              }
            >
              {tab === 'content' ? 'Website Content' : 'Form Submissions'}
            </button>
          ))}
        </div>

        {/* ── Content tab ──────────────────────────────────────────────────── */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Edit your website's text content below. Design and layout changes are managed by your account team.
            </p>

            {pages.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Your website is still being set up.</p>
              </div>
            )}

            {pages.map((page: any) => {
              const isExpanded = expandedPages[page.id] ?? false;
              const editableFields: string[] = [];
              for (const section of page.sections || []) {
                for (const path of section.editable_fields || []) {
                  editableFields.push(path);
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
                        {editableFields.length > 0
                          ? `${editableFields.length} editable field${editableFields.length !== 1 ? 's' : ''}`
                          : 'Managed by your design team'}
                      </p>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-5">
                      {editableFields.length === 0 ? (
                        <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                          <Lock className="w-4 h-4" />
                          This page's content is managed by your design team.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {editableFields.map(path => {
                            const isLong = String(edits[path] || '').length > 80;
                            return (
                              <div key={path}>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{labelFromPath(path)}</label>
                                {isLong ? (
                                  <textarea
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                                    style={{ '--tw-ring-color': c } as React.CSSProperties}
                                    rows={3}
                                    value={edits[path] ?? ''}
                                    onChange={e => setEdits(prev => ({ ...prev, [path]: e.target.value }))}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                                    style={{ '--tw-ring-color': c } as React.CSSProperties}
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
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{ '--tw-ring-color': c } as React.CSSProperties}
                          value={edits[path] ?? ''}
                          onChange={e => setEdits(prev => ({ ...prev, [path]: e.target.value }))}
                        />
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {pages.length > 0 && (
              <div className="sticky bottom-4 pt-2">
                <button
                  onClick={handleSaveContent}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold rounded-xl shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: c }}
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    : saveSuccess ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                    : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
                {saveError && <p className="text-red-500 text-sm text-center mt-2">{saveError}</p>}
              </div>
            )}
          </div>
        )}

        {/* ── Leads tab ────────────────────────────────────────────────────── */}
        {activeTab === 'leads' && (
          <div>
            {leadsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : leads.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-slate-700 mb-2">No submissions yet</h2>
                <p className="text-slate-400 text-sm">Form submissions from your website will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map(lead => {
                  const isNew = lead.status === 'new';
                  const date = new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div
                      key={lead.id}
                      className="bg-white rounded-2xl border shadow-sm p-5"
                      style={{ borderColor: isNew ? c + '40' : '#e2e8f0' }}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900">{lead.name}</span>
                            {isNew && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: c + '15', color: c }}>
                                New
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                            {lead.email && <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>}
                            {lead.phone && <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>}
                            <span>{date}</span>
                          </div>
                          {lead.message && (
                            <p className="text-sm text-slate-600 mt-2 max-w-xl">{lead.message}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {isNew && (
                            <button
                              onClick={() => markLeadStatus(lead.id, 'contacted')}
                              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              Mark Contacted
                            </button>
                          )}
                          {lead.status !== 'resolved' && (
                            <button
                              onClick={() => markLeadStatus(lead.id, 'resolved')}
                              className="text-xs px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
                              style={{ backgroundColor: c }}
                            >
                              Resolve
                            </button>
                          )}
                          {lead.status === 'resolved' && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Resolved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomDomainAdmin;
