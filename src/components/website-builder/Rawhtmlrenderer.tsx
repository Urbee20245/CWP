import React, { useEffect, useRef, useCallback, useState } from 'react';
import { PremiumFeatureId } from '../../types/website';

interface RawHtmlRendererProps {
  rawHtml: string;
  premiumFeatures?: PremiumFeatureId[];
  clientId?: string;
  calBookingLink?: string;
  isPreview?: boolean;
}

/**
 * Renders an exact-clone site by embedding the raw HTML in a full-page iframe.
 *
 * Add-ons (Cal.com button, chat widget) are injected into the iframe's
 * document after load using contentWindow access (same-origin for srcdoc iframes).
 *
 * The iframe auto-resizes to fit the cloned site's full content height
 * so there's no inner scrollbar — the outer page scrolls normally.
 */
const RawHtmlRenderer: React.FC<RawHtmlRendererProps> = ({
  rawHtml,
  premiumFeatures = [],
  clientId,
  calBookingLink,
  isPreview = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState('100vh');

  /**
   * Inject CWP add-on DOM elements into the iframe's document.
   * Called after the iframe finishes loading.
   */
  const injectAddons = useCallback((doc: Document) => {
    if (!doc || !doc.body) return;

    // ── Cal.com floating book button ────────────────────────────────────────
    if (premiumFeatures.includes('cal_com') && calBookingLink) {
      if (!doc.getElementById('cwp-cal-btn')) {
        const btn = doc.createElement('a');
        btn.id = 'cwp-cal-btn';
        btn.href = calBookingLink;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.textContent = '📅 Book a Meeting';
        btn.style.cssText = [
          'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
          'background:#4F46E5', 'color:#fff', 'padding:12px 22px',
          'border-radius:9999px', 'font-family:system-ui,sans-serif',
          'font-size:14px', 'font-weight:700', 'text-decoration:none',
          'box-shadow:0 4px 16px rgba(0,0,0,.3)', 'transition:transform .15s',
        ].join(';');
        btn.addEventListener('mouseover', () => { btn.style.transform = 'scale(1.05)'; });
        btn.addEventListener('mouseout',  () => { btn.style.transform = 'scale(1)'; });
        doc.body.appendChild(btn);
      }
    }

    // ── Chat widget bubble ──────────────────────────────────────────────────
    if (premiumFeatures.includes('chat_widget')) {
      if (!doc.getElementById('cwp-chat-btn')) {
        const calOffset = premiumFeatures.includes('cal_com') ? '88px' : '24px';
        const btn = doc.createElement('button');
        btn.id = 'cwp-chat-btn';
        btn.innerHTML = '💬';
        btn.style.cssText = [
          'position:fixed', `bottom:${calOffset}`, 'right:24px', 'z-index:2147483647',
          'background:#10B981', 'color:#fff', 'width:54px', 'height:54px',
          'border-radius:50%', 'border:none', 'font-size:22px', 'cursor:pointer',
          'box-shadow:0 4px 16px rgba(0,0,0,.3)', 'transition:transform .15s',
        ].join(';');
        btn.addEventListener('mouseover', () => { btn.style.transform = 'scale(1.1)'; });
        btn.addEventListener('mouseout',  () => { btn.style.transform = 'scale(1)'; });
        btn.addEventListener('click', () => {
          window.parent.postMessage({ type: 'cwp_chat_open', clientId }, '*');
        });
        doc.body.appendChild(btn);
      }
    }

    // ── Preview badge (admin-only) ──────────────────────────────────────────
    if (isPreview && !doc.getElementById('cwp-preview-badge')) {
      const badge = doc.createElement('div');
      badge.id = 'cwp-preview-badge';
      badge.textContent = '🔍 Preview Mode — Not Published';
      badge.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
        'background:#F59E0B', 'color:#fff', 'text-align:center',
        'font-family:system-ui,sans-serif', 'font-size:13px', 'font-weight:600',
        'padding:6px 0',
      ].join(';');
      doc.body.insertBefore(badge, doc.body.firstChild);
    }
  }, [premiumFeatures, calBookingLink, clientId, isPreview]);

  /**
   * Auto-resize the iframe to match its content height.
   */
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
      // cross-origin (shouldn't happen with srcdoc, but be safe)
      setIframeHeight('100vh');
    }
  }, []);

  const handleLoad = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      injectAddons(doc);
      syncHeight();

      // Re-sync on DOM mutations (lazy-loaded images, accordions, etc.)
      const observer = new (window as any).MutationObserver(syncHeight);
      observer.observe(doc.body, { childList: true, subtree: true, attributes: true });
    } catch (e) {
      console.warn('[RawHtmlRenderer] iframe access error:', e);
    }
  }, [injectAddons, syncHeight]);

  // Listen for postMessage events from the iframe (e.g. navigation)
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
      // Allow all features so embedded maps, videos, etc. work
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      scrolling="no"
    />
  );
};

export default RawHtmlRenderer;
