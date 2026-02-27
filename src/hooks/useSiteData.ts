import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { WebsiteJson, PremiumFeatureId } from '../types/website';

export type SiteStatus = 'loading' | 'found' | 'coming_soon' | 'not_found';

export interface SiteData {
  websiteJson: WebsiteJson;
  premiumFeatures: PremiumFeatureId[];
  clientId: string;
  calBookingLink: string | null;
  /** Raw HTML for exact-clone sites (site_type === 'raw_html') */
  rawHtml: string | null;
  /** Render mode: null/'cwp_json' = normal, 'raw_html' = iframe clone */
  siteType: string | null;
}

export interface UseSiteDataResult {
  status: SiteStatus;
  siteData: SiteData | null;
}

/**
 * Fetches all data needed to render a public client site.
 *
 * - Returns `coming_soon` when the site exists but is not yet published.
 * - Returns `not_found` when no record matches the slug.
 * - If the `cal_com` premium feature is enabled, also fetches the
 *   Cal.com booking link from `client_cal_calendar`.
 */
export function useSiteData(slug: string | undefined, isPreview = false): UseSiteDataResult {
  const [status, setStatus] = useState<SiteStatus>('loading');
  const [siteData, setSiteData] = useState<SiteData | null>(null);

  useEffect(() => {
    if (!slug) {
      setStatus('not_found');
      return;
    }

    let cancelled = false;

    setStatus('loading');
    setSiteData(null);

    (async () => {
      const { data, error } = await supabase
        .from('website_briefs')
        .select('website_json, is_published, premium_features, client_id, raw_html, site_type')
        .or(`slug.eq.${slug},client_slug.eq.${slug}`)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setStatus('not_found');
        return;
      }

      if (!data.is_published && !isPreview) {
        setStatus('coming_soon');
        return;
      }

      // Raw HTML clone sites don't need website_json
      const isRawHtml = (data as any).site_type === 'raw_html';
      if (!isRawHtml && !data.website_json) {
        setStatus('not_found');
        return;
      }

      const features = (data.premium_features as PremiumFeatureId[]) ?? [];
      let calBookingLink: string | null = null;

      if (features.includes('cal_com')) {
        const { data: calData } = await supabase
          .from('client_cal_calendar')
          .select('cal_booking_link')
          .eq('client_id', data.client_id)
          .maybeSingle();

        if (!cancelled) {
          calBookingLink = (calData as any)?.cal_booking_link ?? null;
        }
      }

      if (cancelled) return;

      setSiteData({
        websiteJson: data.website_json as WebsiteJson,
        premiumFeatures: features,
        clientId: data.client_id,
        calBookingLink,
        rawHtml: (data as any).raw_html ?? null,
        siteType: (data as any).site_type ?? null,
      });
      setStatus('found');
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, isPreview]);

  return { status, siteData };
}
