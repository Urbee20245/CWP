import React, { useRef, useState, useCallback } from 'react';
import { PremiumFeatureId } from '../../types/website';

const STATIC_STORAGE_URL = 'https://nvgumhlewbqynrhlkqhx.supabase.co/storage/v1/object/public/static-sites';

interface StaticSiteRendererProps {
  clientSlug: string;
  premiumFeatures?: PremiumFeatureId[];
  clientId?: string;
  calBookingLink?: string;
  isPreview?: boolean;
}

const StaticSiteRenderer: React.FC<StaticSiteRendererProps> = ({
  clientSlug,
  premiumFeatures = [],
  clientId,
  calBookingLink,
  isPreview = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState('100vh');
  const [loaded, setLoaded] = useState(false);

  // Point directly at the file in Supabase Storage.
  // Using src= instead of srcdoc= is critical — browsers block ES module scripts
  // (type="module") when loaded inside srcdoc iframes due to CSP null-origin rules.
  const siteUrl = `${STATIC_STORAGE_URL}/${clientSlug}/index.html`;

  const syncHeight = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const h = Math.max(doc.body?.scrollHeight ?? 0, doc.documentElement?.scrollHeight ?? 0, 600);
      setIframeHeight(`${h}px`);
    } catch { setIframeHeight('100vh'); }
  }, []);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      // Inject addons
      if (premiumFeatures.includes('cal_com') && calBookingLink) {
        if (!doc.getElementById('cwp-cal-btn')) {
          const btn = doc.createElement('a');
          btn.id = 'cwp-cal-btn';
          btn.href = calBookingLink;
          btn.target = '_blank';
          btn.rel = 'noopener noreferrer';
          btn.textContent = '📅 Book a Meeting';
          btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#4F46E5;color:#fff;padding:12px 22px;border-radius:9999px;font-family:system-ui,sans-serif;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.3);';
          doc.body?.appendChild(btn);
        }
      }
      if (premiumFeatures.includes('chat_widget')) {
        if (!doc.getElementById('cwp-chat-btn')) {
          const bottom = premiumFeatures.includes('cal_com') ? '88px' : '24px';
          const btn = doc.createElement('button');
          btn.id = 'cwp-chat-btn';
          btn.innerHTML = '💬';
          btn.style.cssText = `position:fixed;bottom:${bottom};right:24px;z-index:2147483647;background:#10B981;color:#fff;width:54px;height:54px;border-radius:50%;border:none;font-size:22px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.3);`;
          btn.addEventListener('click', () => {
            window.parent.postMessage({ type: 'cwp_chat_open', clientId }, '*');
          });
          doc.body?.appendChild(btn);
        }
      }
      if (isPreview && !doc.getElementById('cwp-preview-badge')) {
        const badge = doc.createElement('div');
        badge.id = 'cwp-preview-badge';
        badge.textContent = '🔍 Preview Mode — Not Published';
        badge.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#F59E0B;color:#fff;text-align:center;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;padding:6px 0;';
        doc.body?.insertBefore(badge, doc.body.firstChild);
      }
      syncHeight();
      const obs = new MutationObserver(syncHeight);
      if (doc.body) obs.observe(doc.body, { childList: true, subtree: true, attributes: true });
      doc.defaultView?.addEventListener('resize', syncHeight);
    } catch (e) { console.warn('[StaticSiteRenderer]', e); }
  }, [premiumFeatures, calBookingLink, clientId, isPreview, syncHeight]);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={siteUrl}
        title="Client Website"
        onLoad={handleLoad}
        style={{ width: '100%', height: iframeHeight, border: 'none', display: 'block' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
        scrolling="no"
      />
    </div>
  );
};

export default StaticSiteRenderer;
