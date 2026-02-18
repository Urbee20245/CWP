import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import SiteRenderer from '../components/website-builder/SiteRenderer';
import { WebsiteJson } from '../types/website';
import { Loader2, Globe, Calendar, ArrowRight, ArrowLeft, Tag } from 'lucide-react';

type Status = 'loading' | 'found' | 'not_found';

interface SiteInfo {
  client_id: string;
  business_name: string;
  primary_color: string;
  font_heading: string;
  font_body: string;
  logo_url: string;
}

// ── Blog listing ────────────────────────────────────────────────────────────

const BlogListing: React.FC<{ siteInfo: SiteInfo }> = ({ siteInfo }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, category, published_at')
      .eq('client_id', siteInfo.client_id)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .then(({ data }) => { setPosts(data || []); setLoading(false); });

    document.title = `Blog | ${siteInfo.business_name}`;
  }, [siteInfo.client_id, siteInfo.business_name]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: siteInfo.font_body + ', sans-serif' }}>
      <header
        className="sticky top-0 z-50 bg-white shadow-sm"
        style={{ borderBottom: `3px solid ${siteInfo.primary_color}` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            {siteInfo.logo_url && (
              <img src={siteInfo.logo_url} alt={siteInfo.business_name} className="h-9 w-auto object-contain" />
            )}
            <span className="text-xl font-bold" style={{ color: siteInfo.primary_color, fontFamily: siteInfo.font_heading }}>
              {siteInfo.business_name}
            </span>
          </a>
          <a href="/" className="text-sm text-slate-500 hover:text-slate-700">← Back to site</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: siteInfo.font_heading }}>Blog</h1>
          <p className="text-lg text-slate-500">Insights and tips from {siteInfo.business_name}</p>
          <div className="h-1 w-16 rounded-full mt-4" style={{ backgroundColor: siteInfo.primary_color }} />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">No articles published yet.</p>
            <p className="text-slate-400 text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <a
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group block bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="h-1.5" style={{ backgroundColor: siteInfo.primary_color }} />
                <div className="p-6">
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-3"
                    style={{ backgroundColor: `${siteInfo.primary_color}15`, color: siteInfo.primary_color }}
                  >
                    {post.category}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mb-2 group-hover:underline line-clamp-2" style={{ fontFamily: siteInfo.font_heading }}>
                    {post.title}
                  </h2>
                  <p className="text-slate-500 text-sm line-clamp-3 mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(post.published_at)}
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: siteInfo.primary_color }}>
                      Read <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

// ── Blog post ────────────────────────────────────────────────────────────────

const BlogPost: React.FC<{ siteInfo: SiteInfo; postSlug: string }> = ({ siteInfo, postSlug }) => {
  const [post, setPost] = useState<any | null>(null);
  const [postStatus, setPostStatus] = useState<'loading' | 'found' | 'not_found'>('loading');

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('title, excerpt, content, category, author_name, published_at')
      .eq('client_id', siteInfo.client_id)
      .eq('slug', postSlug)
      .eq('is_published', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setPostStatus('not_found'); return; }
        setPost(data);
        document.title = `${data.title} | ${siteInfo.business_name}`;
        setPostStatus('found');
      });
  }, [siteInfo.client_id, siteInfo.business_name, postSlug]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (postStatus === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (postStatus === 'not_found' || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <Globe className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Article not found</h1>
        <a href="/blog" className="mt-4 text-indigo-600 hover:underline text-sm">← Back to Blog</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: siteInfo.font_body + ', sans-serif' }}>
      <header
        className="sticky top-0 z-50 bg-white shadow-sm"
        style={{ borderBottom: `3px solid ${siteInfo.primary_color}` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            {siteInfo.logo_url && (
              <img src={siteInfo.logo_url} alt={siteInfo.business_name} className="h-9 w-auto object-contain" />
            )}
            <span className="text-xl font-bold" style={{ color: siteInfo.primary_color, fontFamily: siteInfo.font_heading }}>
              {siteInfo.business_name}
            </span>
          </a>
          <a href="/blog" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Blog
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-8">
          <span
            className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4"
            style={{ backgroundColor: `${siteInfo.primary_color}15`, color: siteInfo.primary_color }}
          >
            {post.category}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4" style={{ fontFamily: siteInfo.font_heading }}>
            {post.title}
          </h1>
          <p className="text-lg text-slate-500 mb-6">{post.excerpt}</p>
          <div className="flex items-center gap-4 text-sm text-slate-400 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(post.published_at)}
            </div>
            <div className="flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              {post.author_name}
            </div>
          </div>
        </div>

        <article
          className="prose prose-slate prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
          style={{ '--tw-prose-headings': siteInfo.primary_color } as React.CSSProperties}
        />

        <div className="mt-12 pt-8 border-t border-slate-200">
          <a href="/blog" className="inline-flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: siteInfo.primary_color }}>
            <ArrowLeft className="w-4 h-4" />
            Back to all articles
          </a>
        </div>
      </main>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

const CustomDomainSite: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const [websiteJson, setWebsiteJson] = useState<WebsiteJson | null>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  // Parse the path to determine what to render
  const isBlogListing = pathname === '/blog';
  const isBlogPost = pathname.startsWith('/blog/') && pathname.length > 6;
  const blogPostSlug = isBlogPost ? pathname.slice(6) : null;
  const pageSlug = !isBlogListing && !isBlogPost
    ? (pathname === '/' ? '' : pathname.slice(1))
    : null;

  useEffect(() => {
    const hostname = window.location.hostname;

    const fetchSite = async () => {
      const { data, error } = await supabase
        .from('website_briefs')
        .select('client_id, website_json, is_published, business_name')
        .eq('custom_domain', hostname)
        .eq('is_published', true)
        .maybeSingle();

      if (error || !data) { setStatus('not_found'); return; }

      const json = data.website_json as WebsiteJson;
      const g = json?.global;
      setWebsiteJson(json);
      setSiteInfo({
        client_id: data.client_id,
        business_name: g?.business_name || data.business_name,
        primary_color: g?.primary_color || '#4F46E5',
        font_heading: g?.font_heading || 'Inter',
        font_body: g?.font_body || 'Inter',
        logo_url: g?.logo_url || '',
      });
      setStatus('found');
    };

    fetchSite();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (status === 'not_found' || !websiteJson || !siteInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <Globe className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Site not found</h1>
        <p className="text-slate-400">This website isn't published yet or the domain isn't connected.</p>
      </div>
    );
  }

  // Blog routes
  if (isBlogListing) return <BlogListing siteInfo={siteInfo} />;
  if (isBlogPost && blogPostSlug) return <BlogPost siteInfo={siteInfo} postSlug={blogPostSlug} />;

  // Site pages
  const currentPageId = (() => {
    if (pageSlug === '') return 'home';
    const found = websiteJson.pages.find(p => p.slug === pageSlug);
    return found ? found.id : 'home';
  })();

  return (
    <SiteRenderer
      websiteJson={websiteJson}
      currentPageId={currentPageId}
      siteSlug=""
      customDomain={true}
    />
  );
};

export default CustomDomainSite;
