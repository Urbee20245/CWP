import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import SiteRenderer from '../components/website-builder/SiteRenderer';
import { WebsiteJson } from '../types/website';
import { Loader2, Globe } from 'lucide-react';

type Status = 'loading' | 'found' | 'not_found';

const PublicSite: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [websiteJson, setWebsiteJson] = useState<WebsiteJson | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');

  useEffect(() => {
    if (!slug) { setStatus('not_found'); return; }

    const fetchSite = async () => {
      const { data, error } = await supabase
        .from('website_briefs')
        .select('website_json, is_published, business_name')
        .eq('client_slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (error || !data?.website_json) {
        setStatus('not_found');
        return;
      }

      const json = data.website_json as WebsiteJson;
      setWebsiteJson(json);
      setSeoTitle(json.seo?.title || data.business_name || '');
      setSeoDesc(json.seo?.meta_description || '');
      setStatus('found');
    };

    fetchSite();
  }, [slug]);

  // Inject SEO tags
  useEffect(() => {
    if (seoTitle) document.title = seoTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && seoDesc) {
      metaDesc.setAttribute('content', seoDesc);
    }
  }, [seoTitle, seoDesc]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <Globe className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Site not found</h1>
        <p className="text-slate-400">
          This website isn't published yet or the link may be incorrect.
        </p>
      </div>
    );
  }

  return <SiteRenderer websiteJson={websiteJson!} />;
};

export default PublicSite;
