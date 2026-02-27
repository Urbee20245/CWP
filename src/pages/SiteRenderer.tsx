import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Globe, Clock } from 'lucide-react';
import SiteRendererComponent from '../components/website-builder/SiteRenderer';
import RawHtmlRenderer from '../components/website-builder/RawHtmlRenderer';
import { useSiteData } from '../hooks/useSiteData';

// ─── Coming Soon ──────────────────────────────────────────────────────────────

const ComingSoon: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-center px-4">
    <div className="rounded-full bg-white/10 p-6 mb-8">
      <Clock className="w-14 h-14 text-white/70" />
    </div>
    <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
      Coming Soon
    </h1>
    <p className="text-slate-300 text-lg max-w-sm leading-relaxed">
      We're putting the finishing touches on something great. Check back soon!
    </p>
  </div>
);

// ─── Not Found ────────────────────────────────────────────────────────────────

const SiteNotFound: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
    <Globe className="w-16 h-16 text-slate-300 mb-4" />
    <h1 className="text-2xl font-bold text-slate-700 mb-2">Site not found</h1>
    <p className="text-slate-400 max-w-xs">
      This website doesn't exist or the link may be incorrect.
    </p>
  </div>
);

// ─── Route component ──────────────────────────────────────────────────────────

/**
 * Public-facing site renderer for /site/:slug and /site/:slug/:page.
 *
 * Fetches the website_brief by slug, then:
 *  - Shows a spinner while loading
 *  - Shows "Coming Soon" if the site exists but is_published = false
 *  - Shows "Not Found" if no record matches the slug
 *  - Renders the full site (with premium feature sections) if published
 */
const SiteRenderer: React.FC = () => {
  const { slug, page } = useParams<{ slug: string; page?: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const { status, siteData } = useSiteData(slug, isPreview);

  // Resolve the page to display from the URL param
  const currentPageId = (() => {
    if (!siteData) return 'home';
    if (!page) return 'home';
    const found = siteData.websiteJson.pages.find(p => p.slug === page);
    return found ? found.id : 'home';
  })();

  // Per-page SEO: update <title> and meta description
  useEffect(() => {
    if (!siteData) return;
    const activePage =
      siteData.websiteJson.pages.find(p => p.id === currentPageId) ??
      siteData.websiteJson.pages[0];
    if (!activePage) return;

    document.title =
      activePage.seo?.title ?? siteData.websiteJson.global.business_name;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && activePage.seo?.meta_description) {
      metaDesc.setAttribute('content', activePage.seo.meta_description);
    }
  }, [siteData, currentPageId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (status === 'coming_soon') return <ComingSoon />;
  if (status === 'not_found') return <SiteNotFound />;

  // ── Raw HTML clone mode ──────────────────────────────────────────────────
  if (siteData?.siteType === 'raw_html' && siteData.rawHtml) {
    return (
      <RawHtmlRenderer
        rawHtml={siteData.rawHtml}
        premiumFeatures={siteData.premiumFeatures}
        clientId={siteData.clientId}
        calBookingLink={siteData.calBookingLink ?? undefined}
        isPreview={isPreview}
      />
    );
  }

  // ── Standard CWP JSON renderer ───────────────────────────────────────────
  return (
    <SiteRendererComponent
      websiteJson={siteData!.websiteJson}
      currentPageId={currentPageId}
      siteSlug={slug!}
      premiumFeatures={siteData!.premiumFeatures}
      clientId={siteData!.clientId}
      calBookingLink={siteData!.calBookingLink ?? undefined}
      isPreview={isPreview}
    />
  );
};

export default SiteRenderer;
