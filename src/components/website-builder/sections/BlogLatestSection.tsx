import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Tag } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';
import { WebsiteGlobal } from '../../../types/website';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  category: string | null;
}

interface BlogLatestSectionProps {
  global: WebsiteGlobal;
  clientId: string;
  siteSlug: string;
  customDomain?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Renders a "Latest Posts" section by fetching the three most recent
 * published blog_posts for this client from Supabase.
 *
 * Renders nothing while loading or when there are no published posts.
 */
const BlogLatestSection: React.FC<BlogLatestSectionProps> = ({
  global: g,
  clientId,
  siteSlug,
  customDomain,
}) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, published_at, category')
      .eq('client_id', clientId)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setPosts(data as BlogPost[]);
        setReady(true);
      });
  }, [clientId]);

  // Nothing to show yet (or no posts at all)
  if (!ready || posts.length === 0) return null;

  const postHref = (slug: string) =>
    customDomain ? `/blog/${slug}` : `/site/${siteSlug}/blog/${slug}`;

  const allPostsHref = customDomain ? '/blog' : `/site/${siteSlug}/blog`;

  return (
    <section id="blog" className="py-20 px-4 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <h2
              className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3"
              style={{ fontFamily: g.font_heading }}
            >
              Latest Posts
            </h2>
            <p
              className="text-lg text-slate-500"
              style={{ fontFamily: g.font_body }}
            >
              Insights and updates from {g.business_name}
            </p>
          </div>
          <a
            href={allPostsHref}
            className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80 whitespace-nowrap"
            style={{ color: g.primary_color, fontFamily: g.font_body }}
          >
            View all posts
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Post cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map(post => (
            <a
              key={post.id}
              href={postHref(post.slug)}
              className="group flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* Colored top accent bar */}
              <div
                className="h-1.5 w-full flex-shrink-0"
                style={{ backgroundColor: g.primary_color }}
              />

              <div className="flex flex-col flex-1 p-6">
                {/* Category */}
                {post.category && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: g.primary_color }} />
                    <span
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: g.primary_color }}
                    >
                      {post.category}
                    </span>
                  </div>
                )}

                {/* Title */}
                <h3
                  className="text-lg font-bold text-slate-900 mb-3 line-clamp-2 group-hover:underline"
                  style={{ fontFamily: g.font_heading }}
                >
                  {post.title}
                </h3>

                {/* Excerpt */}
                {post.excerpt && (
                  <p
                    className="text-sm text-slate-500 line-clamp-3 leading-relaxed flex-1"
                    style={{ fontFamily: g.font_body }}
                  >
                    {post.excerpt}
                  </p>
                )}

                {/* Date */}
                {post.published_at && (
                  <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                    {formatDate(post.published_at)}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogLatestSection;
