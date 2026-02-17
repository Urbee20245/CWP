import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Loader2, Globe, Calendar, ArrowRight, Tag } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  published_at: string;
}

interface SiteInfo {
  business_name: string;
  primary_color: string;
  font_heading: string;
  font_body: string;
  logo_url: string;
}

const BlogListingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found'>('loading');

  useEffect(() => {
    if (!slug) { setStatus('not_found'); return; }

    const fetchData = async () => {
      const { data: brief } = await supabase
        .from('website_briefs')
        .select('client_id, website_json, is_published, business_name')
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

      const { data: postsData } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, category, published_at')
        .eq('client_id', brief.client_id)
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      setPosts(postsData || []);
      document.title = `Blog | ${g?.business_name || brief.business_name}`;
      setStatus('found');
    };
    fetchData();
  }, [slug]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (status === 'not_found' || !siteInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <Globe className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Blog not found</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: siteInfo.font_body + ', sans-serif' }}>
      {/* Simple site header */}
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
          <a href={`/site/${slug}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to site
          </a>
        </div>
      </header>

      {/* Blog listing */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: siteInfo.font_heading }}>
            Blog
          </h1>
          <p className="text-lg text-slate-500">Insights and tips from {siteInfo.business_name}</p>
          <div className="h-1 w-16 rounded-full mt-4" style={{ backgroundColor: siteInfo.primary_color }} />
        </div>

        {posts.length === 0 ? (
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
                href={`/site/${slug}/blog/${post.slug}`}
                className="group block bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Color stripe */}
                <div className="h-1.5" style={{ backgroundColor: siteInfo.primary_color }} />
                <div className="p-6">
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-3"
                    style={{ backgroundColor: `${siteInfo.primary_color}15`, color: siteInfo.primary_color }}
                  >
                    {post.category}
                  </span>
                  <h2
                    className="text-lg font-bold text-slate-900 mb-2 group-hover:underline line-clamp-2"
                    style={{ fontFamily: siteInfo.font_heading }}
                  >
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

export default BlogListingPage;
