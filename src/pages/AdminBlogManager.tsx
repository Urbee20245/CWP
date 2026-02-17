"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import {
  BookOpen, Loader2, Plus, Trash2, Eye, EyeOff, AlertTriangle,
  CheckCircle, Wand2, RefreshCw, ExternalLink,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AdminService } from '../services/adminService';

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
}

const AdminBlogManager: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [clientSlug, setClientSlug] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Generation form
  const [genTopic, setGenTopic] = useState('');
  const [genWordCount, setGenWordCount] = useState(600);

  // Blog enable toggle
  const [togglingBlogEnabled, setTogglingBlogEnabled] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, business_name, blog_enabled')
        .order('business_name');
      setClients(data || []);
      setLoadingClients(false);
    };
    load();
  }, []);

  const loadPosts = useCallback(async (clientId: string) => {
    setLoadingPosts(true);
    setError(null);
    const { data } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, category, author_name, is_published, published_at, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setPosts(data || []);

    // Also get client slug for preview links
    const { data: brief } = await supabase
      .from('website_briefs')
      .select('client_slug')
      .eq('client_id', clientId)
      .maybeSingle();
    setClientSlug(brief?.client_slug || '');
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId) || null;
      setSelectedClient(client);
      loadPosts(selectedClientId);
    } else {
      setSelectedClient(null);
      setPosts([]);
    }
  }, [selectedClientId, clients, loadPosts]);

  const handleGenerate = async () => {
    if (!selectedClientId) return;
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      await AdminService.generateBlogPost({
        client_id: selectedClientId,
        topic: genTopic || undefined,
        word_count: genWordCount,
      });
      setSuccess('Blog post generated! Review it below before publishing.');
      setGenTopic('');
      await loadPosts(selectedClientId);
    } catch (err: any) {
      setError(err.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    setTogglingId(post.id);
    setError(null);
    const nowPublished = !post.is_published;
    const { error: err } = await supabase
      .from('blog_posts')
      .update({
        is_published: nowPublished,
        published_at: nowPublished ? new Date().toISOString() : null,
      })
      .eq('id', post.id);
    if (err) { setError(err.message); }
    else {
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, is_published: nowPublished, published_at: nowPublished ? new Date().toISOString() : null }
        : p
      ));
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            Blog Manager
          </h1>
          <p className="text-slate-500 mt-1">Generate and manage AI-written blog posts for clients.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Controls */}
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
                      {selectedClient.blog_enabled ? 'Enabled — client has blog access' : 'Disabled — enable to allow blog generation'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleBlogEnabled}
                    disabled={togglingBlogEnabled}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      selectedClient.blog_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        selectedClient.blog_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Generate post card */}
            {selectedClient?.blog_enabled && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Generate New Post</h2>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Topic <span className="text-slate-400 font-normal">(optional — AI picks if blank)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={genTopic}
                    onChange={e => setGenTopic(e.target.value)}
                    placeholder="e.g. How to prevent pipe leaks in winter"
                  />
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Length: ~{genWordCount} words
                  </label>
                  <input
                    type="range"
                    min={300}
                    max={1500}
                    step={100}
                    value={genWordCount}
                    onChange={e => setGenWordCount(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>300</span><span>900</span><span>1500</span>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                    : <><Wand2 className="w-4 h-4" /> Generate Post</>}
                </button>
              </div>
            )}
          </div>

          {/* Right: Posts list */}
          <div className="lg:col-span-2">
            {/* Alerts */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Error</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
              </div>
            )}
            {success && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <p className="text-emerald-700 text-sm font-medium">{success}</p>
                <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">✕</button>
              </div>
            )}

            {!selectedClientId ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500">Select a client to manage their blog.</p>
              </div>
            ) : loadingPosts ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : !selectedClient?.blog_enabled ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-600 font-medium">Blog not enabled</p>
                <p className="text-slate-400 text-sm mt-1">Toggle "Blog Add-on" on the left to enable blog for this client.</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-600 font-medium">No posts yet</p>
                <p className="text-slate-400 text-sm mt-1">Generate the first post using the panel on the left.</p>
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
                  <div key={post.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              post.is_published
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {post.is_published ? '● Live' : '● Draft'}
                          </span>
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {post.category}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-800 truncate">{post.title}</h3>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{post.excerpt}</p>
                        <p className="text-xs text-slate-400 mt-2">
                          Created {formatDate(post.created_at)}
                          {post.published_at ? ` • Published ${formatDate(post.published_at)}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Preview link */}
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

                        {/* Publish toggle */}
                        <button
                          onClick={() => handleTogglePublish(post)}
                          disabled={togglingId === post.id}
                          className={`p-2 rounded-lg border transition-colors ${
                            post.is_published
                              ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                          title={post.is_published ? 'Unpublish' : 'Publish'}
                        >
                          {togglingId === post.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : post.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>

                        {/* Delete */}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminBlogManager;
