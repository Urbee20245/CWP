import React, { useEffect, useState } from 'react';
import { ArrowRight, Calendar, Tag } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';
import { WebsiteGlobal } from '../../../types/website';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  published_at: string;
}

interface BlogPreviewSectionProps {
  content: {
    heading: string;
    subtext: string;
  };
  global: WebsiteGlobal;
  variant: string;
  siteSlug?: string;
}

const BlogPreviewSection: React.FC<BlogPreviewSectionProps> = ({ content, global: g, siteSlug }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!siteSlug) { setLoading(false); return; }

      // Get client_id from slug
      const { data: brief } = await supabase
        .from('website_briefs')
        .select('client_id')
        .eq('client_slug', siteSlug)
        .maybeSingle();

      if (!brief?.client_id) { setLoading(false); return; }

      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, category, published_at')
        .eq('client_id', brief.client_id)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(6);

      setPosts(data || []);
      setLoading(false);
    };
    fetchPosts();
  }, [siteSlug]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: g.font_heading }}
          >
            {content.heading || 'Latest Articles'}
          </h2>
          {content.subtext && (
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">{content.subtext}</p>
          )}
        </div>

        {loading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: `${g.primary_color}15` }}>
              <Tag className="w-7 h-7" style={{ color: g.primary_color }} />
            </div>
            <p className="text-slate-500 text-lg">Articles coming soon.</p>
            <p className="text-slate-400 text-sm mt-1">Check back for expert tips and insights.</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <a
                key={post.id}
                href={siteSlug ? `/site/${siteSlug}/blog/${post.slug}` : '#'}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Category badge */}
                <div className="px-6 pt-6 pb-2">
                  <span
                    className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3"
                    style={{ backgroundColor: `${g.primary_color}15`, color: g.primary_color }}
                  >
                    {post.category}
                  </span>
                  <h3
                    className="text-lg font-bold text-slate-900 mb-2 group-hover:underline line-clamp-2"
                    style={{ fontFamily: g.font_heading }}
                  >
                    {post.title}
                  </h3>
                  <p className="text-slate-500 text-sm line-clamp-3">{post.excerpt}</p>
                </div>
                <div className="px-6 pb-6 pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(post.published_at)}
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: g.primary_color }}>
                    Read more <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default BlogPreviewSection;
