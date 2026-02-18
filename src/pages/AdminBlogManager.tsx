"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import {
  BookOpen, Loader2, Trash2, Eye, EyeOff, AlertTriangle,
  CheckCircle, Wand2, RefreshCw, ExternalLink, Calendar,
  Play, Pause, Image as ImageIcon, Settings, DollarSign,
  Clock, TrendingUp, Zap, Info, Tag,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  business_name: string;
  blog_enabled: boolean;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author_name: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  featured_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  seo_keywords: string[] | null;
}

interface BlogSchedule {
  id: string;
  client_id: string;
  is_active: boolean;
  days_of_week: string[];
  word_count: number;
  auto_publish: boolean;
  generate_images: boolean;
  total_posts_target: number | null;
  posts_generated: number;
  author_name: string;
  started_at: string;
  last_run_at: string | null;
}

const ALL_DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

// ─── Component ───────────────────────────────────────────────────────────────

const AdminBlogManager: React.FC = () => {
  // Client state
  const [clients, setClients]               = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSlug, setClientSlug]         = useState('');
  const [loadingClients, setLoadingClients] = useState(true);

  // Posts state
  const [posts, setPosts]         = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // Schedule state
  const [schedule, setSchedule]         = useState<BlogSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule]   = useState(false);
  const [runningSchedule, setRunningSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    is_active:          true,
    days_of_week:       [] as string[],
    word_count:         600,
    auto_publish:       false,
    generate_images:    true,
    total_posts_target: null as number | null,
    author_name:        'The Team',
  });
  const [useUnlimited, setUseUnlimited] = useState(true);

  // Manual generation state
  const [genTopic, setGenTopic]           = useState('');
  const [genWordCount, setGenWordCount]   = useState(600);
  const [genCount, setGenCount]           = useState(1);
  const [genAutoPublish, setGenAutoPublish] = useState(false);
  const [genImages, setGenImages]         = useState(true);
  const [isGenerating, setIsGenerating]   = useState(false);
  const [genProgress, setGenProgress]     = useState<{ done: number; total: number } | null>(null);

  // Blog enable toggle
  const [togglingBlogEnabled, setTogglingBlogEnabled] = useState(false);

  // Active tab
  const [tab, setTab] = useState<'generate' | 'schedule' | 'posts'>('generate');

  // Alerts
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ─── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, business_name, blog_enabled')
      .order('business_name')
      .then(({ data }) => {
        setClients(data || []);
        setLoadingClients(false);
      });
  }, []);

  const loadPosts = useCallback(async (clientId: string) => {
    setLoadingPosts(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, category, author_name, is_published, published_at, created_at, featured_image_url, meta_title, meta_description, seo_keywords')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setPosts(data || []);

    const { data: brief } = await supabase
      .from('website_briefs')
      .select('client_slug')
      .eq('client_id', clientId)
      .maybeSingle();
    setClientSlug(brief?.client_slug || '');
    setLoadingPosts(false);
  }, []);

  const loadSchedule = useCallback(async (clientId: string) => {
    setLoadingSchedule(true);
    try {
      const s = await AdminService.getBlogSchedule(clientId);
      setSchedule(s || null);
      if (s) {
        setScheduleForm({
          is_active:          s.is_active,
          days_of_week:       s.days_of_week,
          word_count:         s.word_count,
          auto_publish:       s.auto_publish,
          generate_images:    s.generate_images,
          total_posts_target: s.total_posts_target,
          author_name:        s.author_name,
        });
        setUseUnlimited(s.total_posts_target === null);
      }
    } catch { /* no schedule yet */ }
    setLoadingSchedule(false);
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId) || null;
      setSelectedClient(client);
      loadPosts(selectedClientId);
      loadSchedule(selectedClientId);
      setTab('generate');
    } else {
      setSelectedClient(null);
      setPosts([]);
      setSchedule(null);
    }
  }, [selectedClientId, clients, loadPosts, loadSchedule]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleBlogEnabled = async () => {
    if (!selectedClient) return;
    setTogglingBlogEnabled(true);
    const newVal = !selectedClient.blog_enabled;
    const { error: err } = await supabase
      .from('clients')
      .update({ blog_enabled: newVal })
      .eq('id', selectedClient.id);
    if (!err) {
      setSelectedClient(prev => prev ? { ...prev, blog_enabled: newVal } : null);
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, blog_enabled: newVal } : c));
    }
    setTogglingBlogEnabled(false);
  };

  const handleGenerate = async () => {
    if (!selectedClientId) return;
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setGenProgress({ done: 0, total: genCount });

    let successCount = 0;
    for (let i = 0; i < genCount; i++) {
      try {
        await AdminService.generateBlogPost({
          client_id:      selectedClientId,
          topic:          genTopic || undefined,
          word_count:     genWordCount,
          auto_publish:   genAutoPublish,
          generate_image: genImages,
        });
        successCount++;
        setGenProgress({ done: i + 1, total: genCount });
      } catch (err: any) {
        setError(`Post ${i + 1} failed: ${err.message}`);
      }
    }

    if (successCount > 0) {
      setSuccess(`${successCount} post${successCount > 1 ? 's' : ''} generated! ${genAutoPublish ? 'Published live.' : 'Review below before publishing.'}`);
      setGenTopic('');
      await loadPosts(selectedClientId);
    }
    setGenProgress(null);
    setIsGenerating(false);
  };

  const handleToggleDayOfWeek = (day: string) => {
    setScheduleForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  const handleSaveSchedule = async () => {
    if (!selectedClientId) return;
    if (scheduleForm.days_of_week.length === 0) {
      setError('Select at least one day of the week.');
      return;
    }
    setSavingSchedule(true);
    setError(null);
    try {
      const saved = await AdminService.saveBlogSchedule(selectedClientId, {
        ...scheduleForm,
        total_posts_target: useUnlimited ? null : (scheduleForm.total_posts_target ?? null),
      });
      setSchedule(saved);
      setSuccess('Schedule saved! Posts will be auto-generated on the selected days.');
    } catch (err: any) {
      setError(err.message || 'Failed to save schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRunScheduleNow = async () => {
    setRunningSchedule(true);
    setError(null);
    try {
      const result = await AdminService.processBlogSchedules();
      setSuccess(`Schedule ran: ${result?.generated ?? 0} post(s) generated.`);
      await loadPosts(selectedClientId);
      await loadSchedule(selectedClientId);
    } catch (err: any) {
      setError(err.message || 'Failed to run schedule.');
    } finally {
      setRunningSchedule(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!selectedClientId || !window.confirm('Delete this schedule? No future posts will be auto-generated.')) return;
    try {
      await AdminService.deleteBlogSchedule(selectedClientId);
      setSchedule(null);
      setScheduleForm({ is_active: true, days_of_week: [], word_count: 600, auto_publish: false, generate_images: true, total_posts_target: null, author_name: 'The Team' });
      setUseUnlimited(true);
      setSuccess('Schedule deleted.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    setTogglingId(post.id);
    const nowPublished = !post.is_published;
    const { error: err } = await supabase
      .from('blog_posts')
      .update({ is_published: nowPublished, published_at: nowPublished ? new Date().toISOString() : null })
      .eq('id', post.id);
    if (err) { setError(err.message); }
    else {
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, is_published: nowPublished, published_at: nowPublished ? new Date().toISOString() : null }
        : p));
    }
    setTogglingId(null);
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm('Delete this post permanently?')) return;
    setDeletingId(postId);
    const { error: err } = await supabase.from('blog_posts').delete().eq('id', postId);
    if (err) { setError(err.message); }
    else { setPosts(prev => prev.filter(p => p.id !== postId)); }
    setDeletingId(null);
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // ─── Derived state ────────────────────────────────────────────────────────

  const postsLeft = schedule && schedule.total_posts_target
    ? schedule.total_posts_target - (schedule.posts_generated || 0)
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            Blog Manager
          </h1>
          <p className="text-slate-500 mt-1">Auto-generate SEO blog posts for clients. Set it and leave it.</p>
        </div>

        {/* Upsell badge */}
        <div className="mb-6 flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4">
          <DollarSign className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-900">Blog Automation — Premium Monthly Upsell</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Enable Blog Add-on per client, create a subscription product in Billing, and charge monthly for hands-free SEO content generation.
            </p>
          </div>
          <span className="flex-shrink-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">UPSELL</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left column: client selector + blog toggle ── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Client selector */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Client</h2>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                disabled={loadingClients}
              >
                <option value="">Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.business_name}</option>
                ))}
              </select>

              {/* Blog enabled toggle */}
              {selectedClient && (
                <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Blog Add-on</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedClient.blog_enabled ? 'Enabled — billing active' : 'Disabled — enable after client pays'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleBlogEnabled}
                    disabled={togglingBlogEnabled}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${selectedClient.blog_enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${selectedClient.blog_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Schedule status card (when schedule exists) */}
            {selectedClient?.blog_enabled && schedule && (
              <div className={`rounded-2xl border shadow-sm p-5 ${schedule.is_active ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${schedule.is_active ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-sm font-semibold text-slate-800">Auto-Schedule</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${schedule.is_active ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {schedule.is_active ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {schedule.days_of_week.map(d => DAY_LABELS[d]).join(', ')}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                    {schedule.posts_generated} posts generated
                    {schedule.total_posts_target ? ` / ${schedule.total_posts_target} target` : ' (unlimited)'}
                  </p>
                  {schedule.last_run_at && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Last ran {fmtDate(schedule.last_run_at)}
                    </p>
                  )}
                  {postsLeft !== null && (
                    <p className="text-emerald-700 font-medium">{postsLeft} posts remaining</p>
                  )}
                </div>
                <button
                  onClick={handleRunScheduleNow}
                  disabled={runningSchedule}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  {runningSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Run Now (Manual Trigger)
                </button>
              </div>
            )}

            {/* Posts count */}
            {selectedClient?.blog_enabled && posts.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{posts.length}</p>
                  <p className="text-xs text-slate-500">Total posts</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{posts.filter(p => p.is_published).length}</p>
                  <p className="text-xs text-slate-500">Published</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-500">{posts.filter(p => !p.is_published).length}</p>
                  <p className="text-xs text-slate-500">Drafts</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: tabs ── */}
          <div className="lg:col-span-2">

            {/* Global alerts */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm flex-1">{error}</p>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            )}
            {success && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <p className="text-emerald-700 text-sm flex-1">{success}</p>
                <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-600">✕</button>
              </div>
            )}

            {/* No client selected */}
            {!selectedClientId ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500">Select a client to manage their blog.</p>
              </div>
            ) : !selectedClient?.blog_enabled ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-600 font-medium">Blog not enabled</p>
                <p className="text-slate-400 text-sm mt-1">Toggle "Blog Add-on" on the left after the client has paid for this upsell.</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl">
                  {([
                    { key: 'generate', label: 'Generate Posts', icon: Wand2 },
                    { key: 'schedule', label: 'Auto-Schedule', icon: Calendar },
                    { key: 'posts',    label: `Posts (${posts.length})`, icon: BookOpen },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        tab === key
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── Tab: Generate ── */}
                {tab === 'generate' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <h2 className="text-lg font-semibold text-slate-900">Generate Blog Posts</h2>

                    {/* Topic */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Topic <span className="text-slate-400 font-normal">(optional — AI picks based on business niche)</span>
                      </label>
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={genTopic}
                        onChange={e => setGenTopic(e.target.value)}
                        placeholder="e.g. How to prevent pipe leaks in winter"
                      />
                    </div>

                    {/* Word count */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Length: ~{genWordCount} words
                      </label>
                      <input
                        type="range" min={300} max={2000} step={100}
                        value={genWordCount}
                        onChange={e => setGenWordCount(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>300</span><span>800</span><span>1200</span><span>2000</span>
                      </div>
                    </div>

                    {/* Number of posts */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Number of Posts to Generate
                      </label>
                      <div className="flex items-center gap-3">
                        {[1,2,3,5,10].map(n => (
                          <button
                            key={n}
                            onClick={() => setGenCount(n)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                              genCount === n
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                        <input
                          type="number" min={1} max={20}
                          value={genCount}
                          onChange={e => setGenCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {genCount > 1 && (
                        <p className="text-xs text-slate-400 mt-1">Posts are generated sequentially. This may take a minute.</p>
                      )}
                    </div>

                    {/* Options row */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Auto-publish */}
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={genAutoPublish}
                          onChange={e => setGenAutoPublish(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Auto-Publish</p>
                          <p className="text-xs text-slate-400">Publish immediately</p>
                        </div>
                      </label>

                      {/* Generate images */}
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={genImages}
                          onChange={e => setGenImages(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Featured Images</p>
                          <p className="text-xs text-slate-400">Requires PEXELS_API_KEY</p>
                        </div>
                      </label>
                    </div>

                    {/* Progress */}
                    {genProgress && (
                      <div className="bg-indigo-50 rounded-xl p-3">
                        <div className="flex justify-between text-xs text-indigo-700 font-medium mb-2">
                          <span>Generating posts...</span>
                          <span>{genProgress.done} / {genProgress.total}</span>
                        </div>
                        <div className="w-full bg-indigo-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(genProgress.done / genProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Generate button */}
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGenerating
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating ({genProgress?.done ?? 0}/{genCount})...</>
                        : <><Wand2 className="w-4 h-4" /> Generate {genCount > 1 ? `${genCount} Posts` : 'Post'}</>}
                    </button>
                  </div>
                )}

                {/* ── Tab: Auto-Schedule ── */}
                {tab === 'schedule' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-slate-900">Auto-Schedule Configuration</h2>
                      {schedule && (
                        <button
                          onClick={handleDeleteSchedule}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete Schedule
                        </button>
                      )}
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        Posts are auto-generated on the selected days via a daily cron job.
                        AI picks SEO-optimized topics based on the client's business niche — fully hands-free.
                        Add a pg_cron job in Supabase to call <code className="font-mono bg-blue-100 px-1 rounded">process-blog-schedules</code> daily at 8AM UTC.
                      </p>
                    </div>

                    {loadingSchedule ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                    ) : (
                      <>
                        {/* Active toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Schedule Active</p>
                            <p className="text-xs text-slate-500 mt-0.5">Posts will be generated automatically on selected days</p>
                          </div>
                          <button
                            onClick={() => setScheduleForm(p => ({ ...p, is_active: !p.is_active }))}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${scheduleForm.is_active ? 'bg-indigo-600' : 'bg-slate-200'}`}
                          >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${scheduleForm.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {/* Days of week */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-3">
                            Publish Days <span className="text-slate-400 font-normal text-xs">(select days posts are generated)</span>
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {ALL_DAYS.map(day => (
                              <button
                                key={day}
                                onClick={() => handleToggleDayOfWeek(day)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                  scheduleForm.days_of_week.includes(day)
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-slate-500 border-slate-300 hover:border-indigo-400'
                                }`}
                              >
                                {DAY_LABELS[day]}
                              </button>
                            ))}
                          </div>
                          {scheduleForm.days_of_week.length > 0 && (
                            <p className="text-xs text-slate-500 mt-2">
                              ≈ {(scheduleForm.days_of_week.length * 4.3).toFixed(0)} posts/month
                            </p>
                          )}
                        </div>

                        {/* Word count */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Post Length: ~{scheduleForm.word_count} words
                          </label>
                          <input
                            type="range" min={300} max={2000} step={100}
                            value={scheduleForm.word_count}
                            onChange={e => setScheduleForm(p => ({ ...p, word_count: Number(e.target.value) }))}
                            className="w-full accent-indigo-600"
                          />
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>300</span><span>800</span><span>1200</span><span>2000</span>
                          </div>
                        </div>

                        {/* Total posts target */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign Length</label>
                          <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="radio"
                                checked={useUnlimited}
                                onChange={() => setUseUnlimited(true)}
                                className="accent-indigo-600"
                              />
                              <div>
                                <p className="text-sm font-medium text-slate-700">Unlimited (ongoing)</p>
                                <p className="text-xs text-slate-400">Runs forever — perfect for long-term retainer clients</p>
                              </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="radio"
                                checked={!useUnlimited}
                                onChange={() => setUseUnlimited(false)}
                                className="accent-indigo-600"
                              />
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-700">Fixed number of posts</p>
                                  <p className="text-xs text-slate-400">Auto-stops when target is reached</p>
                                </div>
                                {!useUnlimited && (
                                  <input
                                    type="number" min={1}
                                    value={scheduleForm.total_posts_target ?? 12}
                                    onChange={e => setScheduleForm(p => ({ ...p, total_posts_target: Number(e.target.value) }))}
                                    className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                )}
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={scheduleForm.auto_publish}
                              onChange={e => setScheduleForm(p => ({ ...p, auto_publish: e.target.checked }))}
                              className="w-4 h-4 accent-indigo-600"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-700">Auto-Publish</p>
                              <p className="text-xs text-slate-400">Go live immediately</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={scheduleForm.generate_images}
                              onChange={e => setScheduleForm(p => ({ ...p, generate_images: e.target.checked }))}
                              className="w-4 h-4 accent-indigo-600"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-700">Featured Images</p>
                              <p className="text-xs text-slate-400">Via Pexels API</p>
                            </div>
                          </label>
                        </div>

                        {/* Author name */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Author Name</label>
                          <input
                            type="text"
                            value={scheduleForm.author_name}
                            onChange={e => setScheduleForm(p => ({ ...p, author_name: e.target.value }))}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="The Team"
                          />
                        </div>

                        {/* Save */}
                        <button
                          onClick={handleSaveSchedule}
                          disabled={savingSchedule}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {savingSchedule
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                            : <><Settings className="w-4 h-4" /> {schedule ? 'Update Schedule' : 'Activate Schedule'}</>}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* ── Tab: Posts ── */}
                {tab === 'posts' && (
                  <div>
                    {loadingPosts ? (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                      </div>
                    ) : posts.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                        <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-slate-600 font-medium">No posts yet</p>
                        <p className="text-slate-400 text-sm mt-1">Generate posts from the "Generate Posts" tab, or set up an auto-schedule.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-slate-500">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
                          <button
                            onClick={() => loadPosts(selectedClientId)}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                          </button>
                        </div>

                        {posts.map(post => (
                          <div key={post.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Featured image strip */}
                            {post.featured_image_url && (
                              <div className="h-28 overflow-hidden">
                                <img
                                  src={post.featured_image_url}
                                  alt={post.featured_image_alt || post.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            <div className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  {/* Status badges */}
                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${post.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                      {post.is_published ? '● Live' : '● Draft'}
                                    </span>
                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                      {post.category}
                                    </span>
                                    {post.featured_image_url && (
                                      <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> Image
                                      </span>
                                    )}
                                    {post.meta_title && (
                                      <span className="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Tag className="w-3 h-3" /> SEO
                                      </span>
                                    )}
                                  </div>

                                  <h3 className="font-semibold text-slate-800 truncate">{post.title}</h3>
                                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{post.excerpt}</p>

                                  {/* SEO meta preview */}
                                  {post.meta_description && (
                                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-1 italic">
                                      <span className="font-medium not-italic text-slate-500">Meta:</span> {post.meta_description}
                                    </p>
                                  )}

                                  {/* Keywords */}
                                  {post.seo_keywords && post.seo_keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {post.seo_keywords.slice(0, 4).map(kw => (
                                        <span key={kw} className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                          {kw}
                                        </span>
                                      ))}
                                      {post.seo_keywords.length > 4 && (
                                        <span className="text-xs text-slate-400">+{post.seo_keywords.length - 4} more</span>
                                      )}
                                    </div>
                                  )}

                                  <p className="text-xs text-slate-400 mt-2">
                                    Created {fmtDate(post.created_at)}
                                    {post.published_at ? ` • Published ${fmtDate(post.published_at)}` : ''}
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {clientSlug && post.is_published && (
                                    <a
                                      href={`/site/${clientSlug}/blog/${post.slug}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                      title="View live post"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleTogglePublish(post)}
                                    disabled={togglingId === post.id}
                                    className={`p-2 rounded-lg border transition-colors ${post.is_published ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    title={post.is_published ? 'Unpublish' : 'Publish'}
                                  >
                                    {togglingId === post.id
                                      ? <Loader2 className="w-4 h-4 animate-spin" />
                                      : post.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(post.id)}
                                    disabled={deletingId === post.id}
                                    className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                    title="Delete"
                                  >
                                    {deletingId === post.id
                                      ? <Loader2 className="w-4 h-4 animate-spin" />
                                      : <Trash2 className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminBlogManager;
