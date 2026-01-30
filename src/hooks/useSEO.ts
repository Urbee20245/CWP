import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
}

/**
 * Sets document title, meta description, and canonical URL for SEO.
 * Updates on mount and cleans up on unmount by restoring defaults.
 */
export function useSEO({ title, description, canonical }: SEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prevDesc = metaDesc?.content ?? '';
    if (metaDesc) {
      metaDesc.content = description;
    } else {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      metaDesc.content = description;
      document.head.appendChild(metaDesc);
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevCanonical = canonicalLink?.href ?? '';
    if (canonical) {
      if (canonicalLink) {
        canonicalLink.href = canonical;
      } else {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        canonicalLink.href = canonical;
        document.head.appendChild(canonicalLink);
      }
    }

    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    if (ogTitle) ogTitle.content = title;
    if (ogDesc) ogDesc.content = description;
    if (ogUrl && canonical) ogUrl.content = canonical;

    return () => {
      document.title = prevTitle;
      const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (desc) desc.content = prevDesc;
      const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (link) link.href = prevCanonical;
      if (ogTitle) ogTitle.content = prevTitle;
      if (ogDesc) ogDesc.content = prevDesc;
      if (ogUrl) ogUrl.content = prevCanonical;
    };
  }, [title, description, canonical]);
}
