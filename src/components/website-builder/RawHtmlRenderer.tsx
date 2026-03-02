import React, { useEffect, useRef, useCallback, useState } from 'react';
import { PremiumFeatureId } from '../../types/website';

interface BuildConfig {
  framework?: 'react' | 'vue' | 'angular' | 'static' | 'unknown';
  build_tool?: string;
  tailwind_config?: any;
  import_maps?: any;
  google_fonts?: string[];
}

interface RawHtmlRendererProps {
  rawHtml: string;
  buildConfig?: BuildConfig;
  premiumFeatures?: PremiumFeatureId[];
  clientId?: string;
  calBookingLink?: string;
  isPreview?: boolean;
}

const RawHtmlRenderer: React.FC<RawHtmlRendererProps> = ({
  rawHtml,
  buildConfig,
  premiumFeatures = [],
  clientId,
  calBookingLink,
  isPreview = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState('100vh');
  const injectAddons = useCallback((doc: Document) => {
    if (!doc || !doc.body) return;
    if (premiumFeatures.includes('cal_com') && calBookingLink) {
      if (!doc.getElementById('cwp-cal-btn')) {
        const btn = doc.createElement('a');
        btn.id = 'cwp-cal-btn';
        btn.href = calBookingLink;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.textContent = '📅 Book a Meeting';
        btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#4F46E5;color:#fff;padding:12px 22px;border-radius:9999px;font-family:system-ui,sans-serif;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.3);transition:transform .15s;';
        btn.addEventListener('mouseover', () => { btn.style.transform = 'scale(1.05)'; });
        btn.addEventListener('mouseout', () => { btn.style.transform = 'scale(1)'; });
        doc.body.appendChild(btn);
      }
    }
    if (premiumFeatures.includes('chat_widget')) {
      if (!doc.getElementById('cwp-chat-btn')) {
        const calOffset = premiumFeatures.includes('cal_com') ? '88px' : '24px';
        const btn = doc.createElement('button');
        btn.id = 'cwp-chat-btn';
        btn.innerHTML = '💬';
        btn.style.cssText = `position:fixed;bottom:${calOffset};right:24px;z-index:2147483647;background:#10B981;color:#fff;width:54px;height:54px;border-radius:50%;border:none;font-size:22px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.3);transition:transform .15s;`;
        btn.addEventListener('mouseover', () => { btn.style.transform = 'scale(1.1)'; });
        btn.addEventListener('mouseout', () => { btn.style.transform = 'scale(1)'; });
        btn.addEventListener('click', () => {
          window.parent.postMessage({ type: 'cwp_chat_open', clientId }, '*');
        });
        doc.body.appendChild(btn);
      }
    }
    if (isPreview && !doc.getElementById('cwp-preview-badge')) {
      const badge = doc.createElement('div');
      badge.id = 'cwp-preview-badge';
      badge.textContent = '🔍 Preview Mode — Not Published';
      badge.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#F59E0B;color:#fff;text-align:center;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;padding:6px 0;';
      doc.body.insertBefore(badge, doc.body.firstChild);
    }
  }, [premiumFeatures, calBookingLink, clientId, isPreview]);
  const syncHeight = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const h = Math.max(
        doc.body?.scrollHeight ?? 0,
        doc.documentElement?.scrollHeight ?? 0,
        600,
      );
      setIframeHeight(`${h}px`);
    } catch {
      setIframeHeight('100vh');
    }
  }, []);
  const handleLoad = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      injectAddons(doc);
      syncHeight();
      const observer = new MutationObserver(syncHeight);
      observer.observe(doc.body, { childList: true, subtree: true, attributes: true });
      doc.defaultView?.addEventListener('resize', syncHeight);
    } catch (e) {
      console.warn('[RawHtmlRenderer] iframe access error:', e);
    }
  }, [injectAddons, syncHeight]);
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'cwp_resize') setIframeHeight(`${e.data.height}px`);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
  return (
    <iframe
      ref={iframeRef}
      srcDoc={rawHtml}
      title="Client Website"
      onLoad={handleLoad}
      style={{
        width: '100%',
        height: iframeHeight,
        border: 'none',
        display: 'block',
        overflow: 'hidden',
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      scrolling="no"
    />
  );
};
export default RawHtmlRenderer;
