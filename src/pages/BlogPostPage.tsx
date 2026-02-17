import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Globe, Calendar, ArrowLeft, Tag } from 'lucide-react';

interface BlogPost {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author_name: string;
  published_at: string;
}

interface SiteInfo {
  business_name: string;
  primary_color: string;
  font_heading: string;
  font_body: string;
  logo_url: string;
}

const BlogPostPage: React.FC = () => {
  const { slug, post: postSlug } = useParams<{ slug: string; post: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found'>('loading');

  useEffect(() => {
    if (!slug || !postSlug) { setStatus('not_found'); return; }

    const fetchData = async () => {
      const { data: brief } = await supabase
        .from('website_briefs')
        .select('client_id, website_json, business_name')
        .eq('client_slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (!brief) { setStatus('not_found'); return; }

      const g = (brief.website_json as any)?.global;
      setSiteInfo({
        business_name: g?.business_name || brief.business_name,
        primary_color: g?.primary_color || '#4F46E5',
        font_heading: g?.font_heading || 'Inter',
        font_body: g?.font_body || 'Inter',
        logo_url: g?.logo_url || '',
      });

      const { data: postData } = await supabase
        .from('blog_posts')
        .select('title, excerpt, content, category, author_name, published_at')
        .eq('client_id', brief.client_id)
        .eq('slug', postSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (!postData) { setStatus('not_found'); return; }

      setPost(postData);
      document.title = `${postData.title} | ${g?.business_name || brief.business_name}`;
      setStatus('found');
    };
    fetchData();
  }, [slug, postSlug]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (status === 'not_found' || !siteInfo || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <Globe className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Article not found</h1>
        <a href={`/site/${slug}/blog`} className="mt-4 text-indigo-600 hover:underline text-sm">
          ← Back to Blog
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: siteInfo.font_body + ', sans-serif' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 bg-white shadow-sm"
        style={{ borderBottom: `3px solid ${siteInfo.primary_color}` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href={`/site/${slug}`} className="flex items-center gap-3">
            {siteInfo.logo_url && (
              <img src={siteInfo.logo_url} alt={siteInfo.business_name} className="h-9 w-auto object-contain" />
            )}
            <span className="text-xl font-bold" style={{ color: siteInfo.primary_color, fontFamily: siteInfo.font_heading }}>
              {siteInfo.business_name}
            </span>
          </a>
          <a href={`/site/${slug}/blog`} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Blog
          </a>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        {/* Meta */}
        <div className="mb-8">
          <span
            className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4"
            style={{ backgroundColor: `${siteInfo.primary_color}15`, color: siteInfo.primary_color }}
          >
            {post.category}
          </span>
          <h1
            className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4"
            style={{ fontFamily: siteInfo.font_heading }}
          >
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

        {/* Article content */}
        <article
          className="prose prose-slate prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
          style={{
            '--tw-prose-headings': siteInfo.primary_color,
          } as React.CSSProperties}
        />

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <a
            href={`/site/${slug}/blog`}
            className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
            style={{ color: siteInfo.primary_color }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all articles
          </a>
        </div>
      </main>
    </div>
  );
};

export default BlogPostPage;
