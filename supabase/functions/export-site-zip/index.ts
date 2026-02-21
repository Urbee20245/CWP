export const config = { auth: false };

// @ts-ignore - JSZip works in Deno via esm.sh
import JSZip from 'https://esm.sh/jszip@3.10.1';
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Global {
  business_name: string;
  phone?: string;
  address?: string;
  primary_color: string;
  font_heading?: string;
  font_body?: string;
  logo_url?: string;
}

interface Section {
  section_type: string;
  variant: string;
  content: Record<string, unknown>;
}

interface Page {
  id: string;
  name: string;
  slug: string;
  sections: Section[];
}

interface WebsiteJson {
  global: Global;
  pages: Page[];
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  author_name?: string;
  published_at?: string;
  featured_image_url?: string;
  category?: string;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function esc(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function googleFontLink(heading: string, body: string): string {
  const families = [...new Set([heading, body])]
    .filter(Boolean)
    .map(f => f.replace(/ /g, '+'))
    .join('&family=');
  if (!families) return '';
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${families}:wght@400;500;600;700;800&display=swap">`;
}

// ─── Section renderers ────────────────────────────────────────────────────────

function renderHero(s: Section, g: Global): string {
  const c = s.content as Record<string, string>;
  const pc = g.primary_color;
  const isDark = c.background_style === 'dark';
  const bg = isDark ? '#1e293b' : c.background_style === 'light' ? '#f8fafc' : `linear-gradient(135deg,${pc}22 0%,${pc}08 100%)`;
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  return `
<section style="padding:6rem 1rem;text-align:center;background:${bg};color:${textColor};">
  <div style="max-width:48rem;margin:0 auto;">
    <h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:800;line-height:1.15;margin-bottom:1.5rem;font-family:${g.font_heading || 'inherit'};color:${isDark ? '#fff' : '#0f172a'};">
      ${esc(c.headline)}
    </h1>
    <p style="font-size:1.2rem;opacity:0.8;margin-bottom:2.5rem;font-family:${g.font_body || 'inherit'};">
      ${esc(c.subheadline)}
    </p>
    ${c.cta_primary_text ? `<a href="${esc(c.cta_primary_link || '#contact')}" style="display:inline-block;padding:1rem 2.5rem;background:${pc};color:#fff;border-radius:0.75rem;font-size:1.1rem;font-weight:600;text-decoration:none;box-shadow:0 4px 14px rgba(${hexToRgb(pc)},0.4);">${esc(c.cta_primary_text)}</a>` : ''}
    ${c.cta_secondary_text ? `&nbsp;<a href="${esc(c.cta_secondary_link || '#about')}" style="display:inline-block;padding:1rem 2rem;border:2px solid ${pc};color:${pc};border-radius:0.75rem;font-size:1rem;font-weight:600;text-decoration:none;margin-top:0.5rem;">${esc(c.cta_secondary_text)}</a>` : ''}
  </div>
</section>`;
}

function renderServices(s: Section, g: Global): string {
  const c = s.content as Record<string, unknown>;
  const pc = g.primary_color;
  const services = (c.services as Array<Record<string, string>>) || [];
  const cards = services.map((svc, i) => `
    <div style="padding:1.5rem;border-radius:1rem;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.06);background:#fff;">
      <div style="width:3rem;height:3rem;border-radius:0.75rem;background:${pc};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;margin-bottom:1rem;">${esc(svc.name?.charAt(0) || '★')}</div>
      <h3 style="font-size:1.1rem;font-weight:600;color:#0f172a;margin-bottom:0.5rem;font-family:${g.font_heading || 'inherit'};">${esc(svc.name)}</h3>
      <p style="color:#475569;font-size:0.9rem;font-family:${g.font_body || 'inherit'};">${esc(svc.description)}</p>
    </div>`).join('');
  return `
<section style="padding:5rem 1rem;background:#fff;">
  <div style="max-width:72rem;margin:0 auto;">
    <h2 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;text-align:center;color:#0f172a;margin-bottom:3rem;font-family:${g.font_heading || 'inherit'};">${esc(String(c.heading || ''))}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;">${cards}</div>
  </div>
</section>`;
}

function renderAbout(s: Section, g: Global): string {
  const c = s.content as Record<string, string>;
  const pc = g.primary_color;
  return `
<section style="padding:5rem 1rem;background:#f8fafc;">
  <div style="max-width:64rem;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center;">
    <div>
      <h2 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;color:#0f172a;margin-bottom:1.5rem;font-family:${g.font_heading || 'inherit'};">${esc(c.heading)}</h2>
      <p style="color:#475569;line-height:1.8;font-family:${g.font_body || 'inherit'};">${esc(c.body)}</p>
      ${c.cta_text ? `<a href="${esc(c.cta_link || '#contact')}" style="display:inline-block;margin-top:1.5rem;padding:0.75rem 2rem;background:${pc};color:#fff;border-radius:0.75rem;font-weight:600;text-decoration:none;">${esc(c.cta_text)}</a>` : ''}
    </div>
    <div style="height:20rem;border-radius:1.25rem;background:${pc}22;display:flex;align-items:center;justify-content:center;font-size:4rem;font-weight:800;color:${pc};">${g.business_name.charAt(0)}</div>
  </div>
</section>`;
}

function renderSocialProof(s: Section, g: Global): string {
  const c = s.content as Record<string, unknown>;
  const pc = g.primary_color;
  const testimonials = (c.testimonials as Array<Record<string, string>>) || [];
  const cards = testimonials.map(t => `
    <div style="padding:1.5rem;border-radius:1rem;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
      <p style="color:#475569;font-style:italic;margin-bottom:1rem;font-family:${g.font_body || 'inherit'};">"${esc(t.quote)}"</p>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <div style="width:2.5rem;height:2.5rem;border-radius:50%;background:${pc};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${esc(t.author?.charAt(0))}</div>
        <div>
          <p style="font-weight:600;color:#0f172a;font-size:0.9rem;">${esc(t.author)}</p>
          ${t.role ? `<p style="color:#64748b;font-size:0.8rem;">${esc(t.role)}</p>` : ''}
        </div>
      </div>
    </div>`).join('');
  return `
<section style="padding:5rem 1rem;background:#f8fafc;">
  <div style="max-width:72rem;margin:0 auto;">
    <h2 style="font-size:clamp(1.75rem,4vw,2.25rem);font-weight:700;text-align:center;color:#0f172a;margin-bottom:3rem;font-family:${g.font_heading || 'inherit'};">${esc(String(c.heading || 'What Our Clients Say'))}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;">${cards}</div>
  </div>
</section>`;
}

function renderContactCta(s: Section, g: Global): string {
  const c = s.content as Record<string, string>;
  const pc = g.primary_color;
  return `
<section id="contact" style="padding:5rem 1rem;background:${pc};color:#fff;text-align:center;">
  <div style="max-width:48rem;margin:0 auto;">
    <h2 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;margin-bottom:1rem;font-family:${g.font_heading || 'inherit'};">${esc(c.heading)}</h2>
    <p style="opacity:0.85;font-size:1.1rem;margin-bottom:2rem;font-family:${g.font_body || 'inherit'};">${esc(c.subheading)}</p>
    ${c.cta_text ? `<a href="${esc(c.cta_link || `mailto:contact@${g.business_name.toLowerCase().replace(/\s+/g,'')}.com`)}" style="display:inline-block;padding:1rem 2.5rem;background:#fff;color:${pc};border-radius:0.75rem;font-weight:700;font-size:1.1rem;text-decoration:none;">${esc(c.cta_text)}</a>` : ''}
    ${g.phone ? `<p style="margin-top:1.5rem;opacity:0.8;font-size:0.9rem;">Or call us: <a href="tel:${g.phone.replace(/\D/g,'')}" style="color:#fff;font-weight:600;">${esc(g.phone)}</a></p>` : ''}
  </div>
</section>`;
}

function renderContactForm(s: Section, g: Global): string {
  const c = s.content as Record<string, string>;
  const pc = g.primary_color;
  return `
<section style="padding:5rem 1rem;background:#fff;">
  <div style="max-width:40rem;margin:0 auto;">
    <h2 style="font-size:clamp(1.5rem,4vw,2rem);font-weight:700;text-align:center;color:#0f172a;margin-bottom:0.5rem;font-family:${g.font_heading || 'inherit'};">${esc(c.heading || 'Get in Touch')}</h2>
    <p style="text-align:center;color:#64748b;margin-bottom:2rem;font-family:${g.font_body || 'inherit'};">${esc(c.subheading || '')}</p>
    <form style="display:flex;flex-direction:column;gap:1rem;" onsubmit="return false;">
      <input type="text" placeholder="Your Name" style="padding:0.75rem 1rem;border:1px solid #e2e8f0;border-radius:0.5rem;font-size:1rem;outline:none;">
      <input type="email" placeholder="Email Address" style="padding:0.75rem 1rem;border:1px solid #e2e8f0;border-radius:0.5rem;font-size:1rem;outline:none;">
      <input type="tel" placeholder="Phone Number" style="padding:0.75rem 1rem;border:1px solid #e2e8f0;border-radius:0.5rem;font-size:1rem;outline:none;">
      <textarea placeholder="Your Message" rows="5" style="padding:0.75rem 1rem;border:1px solid #e2e8f0;border-radius:0.5rem;font-size:1rem;outline:none;resize:vertical;"></textarea>
      <button type="submit" style="padding:0.875rem;background:${pc};color:#fff;border:none;border-radius:0.75rem;font-size:1rem;font-weight:600;cursor:pointer;">${esc(c.button_text || 'Send Message')}</button>
    </form>
    <p style="margin-top:1rem;text-align:center;font-size:0.8rem;color:#94a3b8;">⚠️ Note: This form was active on your hosted site. To enable submissions on your new host, reconnect the form to a backend service.</p>
  </div>
</section>`;
}

function renderFaq(s: Section, g: Global): string {
  const c = s.content as Record<string, unknown>;
  const faqs = (c.faqs as Array<Record<string, string>>) || [];
  const items = faqs.map((faq, i) => `
    <details style="border:1px solid #e2e8f0;border-radius:0.75rem;overflow:hidden;margin-bottom:0.5rem;">
      <summary style="padding:1rem 1.25rem;font-weight:600;color:#0f172a;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;font-family:${g.font_heading || 'inherit'};">
        ${esc(faq.question)} <span style="color:${g.primary_color};font-size:1.25rem;">+</span>
      </summary>
      <div style="padding:0 1.25rem 1rem;color:#475569;font-family:${g.font_body || 'inherit'};line-height:1.7;">${esc(faq.answer)}</div>
    </details>`).join('');
  return `
<section style="padding:5rem 1rem;background:#fff;">
  <div style="max-width:56rem;margin:0 auto;">
    <h2 style="font-size:clamp(1.75rem,4vw,2.25rem);font-weight:700;text-align:center;color:#0f172a;margin-bottom:3rem;font-family:${g.font_heading || 'inherit'};">${esc(String(c.heading || 'Frequently Asked Questions'))}</h2>
    ${items}
  </div>
</section>`;
}

function renderStats(s: Section, g: Global): string {
  const c = s.content as Record<string, unknown>;
  const stats = (c.stats as Array<Record<string, string>>) || [];
  const items = stats.map(stat => `
    <div style="text-align:center;">
      <div style="font-size:2.5rem;font-weight:800;color:${g.primary_color};font-family:${g.font_heading || 'inherit'};">${esc(stat.value)}</div>
      <div style="font-size:0.9rem;color:#64748b;margin-top:0.25rem;font-family:${g.font_body || 'inherit'};">${esc(stat.label)}</div>
    </div>`).join('');
  return `
<section style="padding:4rem 1rem;background:#f8fafc;">
  <div style="max-width:64rem;margin:0 auto;">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:2rem;">${items}</div>
  </div>
</section>`;
}

function renderGallery(s: Section, g: Global): string {
  const c = s.content as Record<string, unknown>;
  const images = (c.images as Array<Record<string, string>>) || [];
  const items = images.map(img => `
    <div style="aspect-ratio:4/3;border-radius:0.75rem;overflow:hidden;background:${g.primary_color}22;">
      ${img.url ? `<img src="${esc(img.url)}" alt="${esc(img.alt || '')}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${g.primary_color};font-size:2rem;">📷</div>`}
    </div>`).join('');
  return `
<section style="padding:5rem 1rem;background:#fff;">
  <div style="max-width:72rem;margin:0 auto;">
    <h2 style="font-size:clamp(1.75rem,4vw,2.25rem);font-weight:700;text-align:center;color:#0f172a;margin-bottom:3rem;font-family:${g.font_heading || 'inherit'};">${esc(String(c.heading || 'Our Work'))}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;">${items || '<p style="text-align:center;color:#64748b;">Gallery coming soon.</p>'}</div>
  </div>
</section>`;
}

function renderPricing(s: Section, g: Global): string {
  const c = s.content as Record<string, unknown>;
  const plans = (c.plans as Array<Record<string, unknown>>) || [];
  const cards = plans.map((plan: Record<string, unknown>, i: number) => {
    const features = (plan.features as string[]) || [];
    const isFeatured = i === 1;
    return `
    <div style="padding:2rem;border-radius:1.25rem;border:${isFeatured ? `2px solid ${g.primary_color}` : '1px solid #e2e8f0'};background:${isFeatured ? g.primary_color : '#fff'};color:${isFeatured ? '#fff' : '#0f172a'};position:relative;">
      ${isFeatured ? `<div style="position:absolute;top:-0.75rem;left:50%;transform:translateX(-50%);background:#fbbf24;color:#1e293b;font-size:0.75rem;font-weight:700;padding:0.25rem 0.75rem;border-radius:999px;">POPULAR</div>` : ''}
      <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:0.5rem;font-family:${g.font_heading || 'inherit'};">${esc(String(plan.name || ''))}</h3>
      <div style="font-size:2.5rem;font-weight:800;margin-bottom:1.5rem;">${esc(String(plan.price || ''))}<span style="font-size:1rem;font-weight:400;opacity:0.7;">${esc(String(plan.period || '/mo'))}</span></div>
      <ul style="list-style:none;padding:0;margin:0 0 2rem;display:flex;flex-direction:column;gap:0.5rem;">
        ${features.map((f: string) => `<li style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;"><span style="color:${isFeatured ? '#fff' : g.primary_color};">✓</span> ${esc(f)}</li>`).join('')}
      </ul>
      <a href="#contact" style="display:block;text-align:center;padding:0.875rem;background:${isFeatured ? '#fff' : g.primary_color};color:${isFeatured ? g.primary_color : '#fff'};border-radius:0.75rem;font-weight:600;text-decoration:none;">${esc(String(plan.cta || 'Get Started'))}</a>
    </div>`;
  }).join('');
  return `
<section style="padding:5rem 1rem;background:#f8fafc;">
  <div style="max-width:64rem;margin:0 auto;">
    <h2 style="font-size:clamp(1.75rem,4vw,2.25rem);font-weight:700;text-align:center;color:#0f172a;margin-bottom:3rem;font-family:${g.font_heading || 'inherit'};">${esc(String(c.heading || 'Pricing'))}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;">${cards}</div>
  </div>
</section>`;
}

function renderBlogPreview(s: Section, g: Global): string {
  const c = s.content as Record<string, string>;
  return `
<section style="padding:5rem 1rem;background:#fff;">
  <div style="max-width:56rem;margin:0 auto;text-align:center;">
    <h2 style="font-size:clamp(1.75rem,4vw,2.25rem);font-weight:700;color:#0f172a;margin-bottom:1rem;font-family:${g.font_heading || 'inherit'};">${esc(c.heading || 'Latest from Our Blog')}</h2>
    <p style="color:#64748b;font-family:${g.font_body || 'inherit'};">${esc(c.subtext || '')}</p>
    <a href="blog/index.html" style="display:inline-block;margin-top:1.5rem;padding:0.75rem 2rem;background:${g.primary_color};color:#fff;border-radius:0.75rem;font-weight:600;text-decoration:none;">View All Posts</a>
  </div>
</section>`;
}

function renderSection(s: Section, g: Global): string {
  switch (s.section_type) {
    case 'hero':          return renderHero(s, g);
    case 'services':      return renderServices(s, g);
    case 'about':         return renderAbout(s, g);
    case 'social_proof':  return renderSocialProof(s, g);
    case 'contact_cta':   return renderContactCta(s, g);
    case 'contact_form':  return renderContactForm(s, g);
    case 'faq':           return renderFaq(s, g);
    case 'stats':         return renderStats(s, g);
    case 'gallery':       return renderGallery(s, g);
    case 'pricing_cards': return renderPricing(s, g);
    case 'blog_preview':  return renderBlogPreview(s, g);
    default:
      console.warn(`[export-site-zip] Unknown section_type: ${s.section_type}`);
      return '';
  }
}

// ─── Nav & Footer ─────────────────────────────────────────────────────────────

function renderNav(g: Global, pages: Page[], currentSlug: string): string {
  const navLinks = pages.map(p => {
    const href = p.slug === '' ? 'index.html' : `${p.slug}/index.html`;
    const active = p.slug === currentSlug;
    return `<a href="${href}" style="text-decoration:none;font-size:0.9rem;font-weight:${active ? '700' : '500'};color:${active ? g.primary_color : '#374151'};padding:0.25rem 0.5rem;border-radius:0.375rem;">${esc(p.name)}</a>`;
  }).join('');
  return `
<header style="position:sticky;top:0;z-index:50;background:#fff;border-bottom:3px solid ${g.primary_color};box-shadow:0 1px 4px rgba(0,0,0,0.06);">
  <div style="max-width:72rem;margin:0 auto;padding:0 1.5rem;height:4rem;display:flex;align-items:center;justify-content:space-between;">
    <a href="index.html" style="font-size:1.25rem;font-weight:800;color:#0f172a;text-decoration:none;font-family:${g.font_heading || 'inherit'};">${esc(g.business_name)}</a>
    <nav style="display:flex;gap:0.5rem;flex-wrap:wrap;">${navLinks}</nav>
    ${g.phone ? `<a href="tel:${g.phone.replace(/\D/g,'')}" style="font-size:0.9rem;font-weight:600;color:${g.primary_color};text-decoration:none;">${esc(g.phone)}</a>` : ''}
  </div>
</header>`;
}

function renderFooter(g: Global, pages: Page[]): string {
  const year = new Date().getFullYear();
  const navLinks = pages.map(p => {
    const href = p.slug === '' ? '../index.html' : `../${p.slug}/index.html`;
    return `<a href="${href}" style="color:#94a3b8;text-decoration:none;font-size:0.875rem;">${esc(p.name)}</a>`;
  }).join('\n      ');
  return `
<footer style="background:#0f172a;color:#94a3b8;padding:3rem 1.5rem;">
  <div style="max-width:72rem;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:2.5rem;">
    <div>
      <div style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:0.75rem;font-family:${g.font_heading || 'inherit'};">${esc(g.business_name)}</div>
      ${g.address ? `<p style="font-size:0.875rem;margin-bottom:0.5rem;">📍 ${esc(g.address)}</p>` : ''}
      ${g.phone ? `<a href="tel:${g.phone.replace(/\D/g,'')}" style="font-size:0.875rem;color:#94a3b8;text-decoration:none;">📞 ${esc(g.phone)}</a>` : ''}
    </div>
    <div>
      <div style="font-size:0.75rem;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1rem;">Navigation</div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        ${navLinks}
      </div>
    </div>
  </div>
  <div style="max-width:72rem;margin:2rem auto 0;padding-top:1.5rem;border-top:1px solid #1e293b;text-align:center;font-size:0.8rem;">
    © ${year} ${esc(g.business_name)}. All rights reserved. · Exported from <strong>Custom Websites Plus</strong>
  </div>
</footer>`;
}

// ─── Full page shell ──────────────────────────────────────────────────────────

function pageShell(opts: {
  title: string;
  description?: string;
  primaryColor: string;
  fontHeading?: string;
  fontBody?: string;
  bodyContent: string;
  nav: string;
  footer: string;
}): string {
  const { title, description, primaryColor, fontHeading, fontBody, bodyContent, nav, footer } = opts;
  const fontLink = googleFontLink(fontHeading || '', fontBody || '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${esc(title)}</title>
  ${description ? `<meta name="description" content="${esc(description)}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${fontLink}
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:${fontBody ? `'${fontBody}',` : ''}sans-serif;line-height:1.6;color:#1e293b;background:#fff;}
    img{max-width:100%;height:auto;}
    details summary::-webkit-details-marker{display:none;}
    @media(max-width:640px){
      nav a{font-size:0.8rem !important;}
      header div[style*="justify-content"]{flex-wrap:wrap;height:auto !important;padding:0.75rem 1rem !important;gap:0.5rem;}
    }
  </style>
</head>
<body>
${nav}
<main>
${bodyContent}
</main>
${footer}
</body>
</html>`;
}

// ─── Blog page generators ─────────────────────────────────────────────────────

function buildBlogIndex(posts: BlogPost[], g: Global, pages: Page[], basePath: string): string {
  const nav = renderNav(g, pages, 'blog').replace(/href="(\w+\/index\.html|index\.html)"/g, (_, href) => `href="${basePath}${href}"`);
  const footer = renderFooter(g, pages);
  const pc = g.primary_color;
  const cards = posts.length === 0
    ? '<p style="text-align:center;color:#64748b;padding:3rem 0;">No blog posts published yet.</p>'
    : posts.map(post => `
    <a href="${esc(post.slug)}.html" style="display:block;text-decoration:none;border-radius:1rem;border:1px solid #e2e8f0;overflow:hidden;transition:box-shadow 0.2s;background:#fff;">
      ${post.featured_image_url ? `<img src="${esc(post.featured_image_url)}" alt="${esc(post.title)}" style="width:100%;height:12rem;object-fit:cover;">` : `<div style="width:100%;height:8rem;background:${pc}18;display:flex;align-items:center;justify-content:center;font-size:2rem;">📝</div>`}
      <div style="padding:1.25rem;">
        ${post.category ? `<span style="font-size:0.75rem;font-weight:700;color:${pc};text-transform:uppercase;letter-spacing:0.05em;">${esc(post.category)}</span>` : ''}
        <h2 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin:0.5rem 0;font-family:${g.font_heading || 'inherit'};">${esc(post.title)}</h2>
        ${post.excerpt ? `<p style="font-size:0.875rem;color:#475569;font-family:${g.font_body || 'inherit'};">${esc(post.excerpt)}</p>` : ''}
        <p style="font-size:0.75rem;color:#94a3b8;margin-top:0.75rem;">By ${esc(post.author_name || 'The Team')} · ${post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</p>
      </div>
    </a>`).join('');

  const body = `
<section style="padding:5rem 1rem;background:#f8fafc;text-align:center;">
  <h1 style="font-size:2.5rem;font-weight:800;color:#0f172a;margin-bottom:0.75rem;font-family:${g.font_heading || 'inherit'};">${esc(g.business_name)} Blog</h1>
  <p style="color:#64748b;font-size:1.1rem;">News, tips and insights from our team</p>
</section>
<section style="padding:3rem 1rem 5rem;background:#fff;">
  <div style="max-width:72rem;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem;">
    ${cards}
  </div>
</section>`;

  return pageShell({
    title: `Blog | ${g.business_name}`,
    description: `Latest news and insights from ${g.business_name}`,
    primaryColor: pc,
    fontHeading: g.font_heading,
    fontBody: g.font_body,
    bodyContent: body,
    nav: renderNavForBlog(g, pages),
    footer,
  });
}

/** Nav specifically for blog pages — links point one level up */
function renderNavForBlog(g: Global, pages: Page[]): string {
  const navLinks = pages.map(p => {
    const href = p.slug === '' ? '../index.html' : `../${p.slug}/index.html`;
    return `<a href="${href}" style="text-decoration:none;font-size:0.9rem;font-weight:500;color:#374151;padding:0.25rem 0.5rem;border-radius:0.375rem;">${esc(p.name)}</a>`;
  }).join('');
  return `
<header style="position:sticky;top:0;z-index:50;background:#fff;border-bottom:3px solid ${g.primary_color};box-shadow:0 1px 4px rgba(0,0,0,0.06);">
  <div style="max-width:72rem;margin:0 auto;padding:0 1.5rem;height:4rem;display:flex;align-items:center;justify-content:space-between;">
    <a href="../index.html" style="font-size:1.25rem;font-weight:800;color:#0f172a;text-decoration:none;font-family:${g.font_heading || 'inherit'};">${esc(g.business_name)}</a>
    <nav style="display:flex;gap:0.5rem;flex-wrap:wrap;">${navLinks}</nav>
    ${g.phone ? `<a href="tel:${g.phone.replace(/\D/g,'')}" style="font-size:0.9rem;font-weight:600;color:${g.primary_color};text-decoration:none;">${esc(g.phone)}</a>` : ''}
  </div>
</header>`;
}

function buildBlogPost(post: BlogPost, g: Global, pages: Page[]): string {
  const pc = g.primary_color;
  // Basic Markdown-to-HTML: convert **bold**, *italic*, # headings, newlines to <p>
  const contentHtml = post.content
    ? post.content
        .replace(/^#{3} (.+)$/gm, '<h3 style="font-size:1.2rem;font-weight:700;margin:1.5rem 0 0.5rem;">$1</h3>')
        .replace(/^#{2} (.+)$/gm, '<h2 style="font-size:1.4rem;font-weight:700;margin:2rem 0 0.75rem;">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 style="font-size:1.75rem;font-weight:800;margin:2rem 0 1rem;">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p style="margin-bottom:1rem;">')
        .replace(/^/, '<p style="margin-bottom:1rem;">')
        .replace(/$/, '</p>')
    : '<p style="color:#64748b;">Content not available.</p>';

  const body = `
${post.featured_image_url ? `<div style="width:100%;max-height:28rem;overflow:hidden;"><img src="${esc(post.featured_image_url)}" alt="${esc(post.title)}" style="width:100%;height:28rem;object-fit:cover;"></div>` : ''}
<article style="max-width:48rem;margin:0 auto;padding:3rem 1.5rem;">
  <a href="index.html" style="color:${pc};text-decoration:none;font-size:0.875rem;font-weight:600;">← Back to Blog</a>
  ${post.category ? `<div style="margin-top:1.5rem;"><span style="font-size:0.75rem;font-weight:700;color:${pc};text-transform:uppercase;letter-spacing:0.05em;">${esc(post.category)}</span></div>` : ''}
  <h1 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:800;color:#0f172a;margin:1rem 0;line-height:1.2;font-family:${g.font_heading || 'inherit'};">${esc(post.title)}</h1>
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid #e2e8f0;">
    <div style="width:2.5rem;height:2.5rem;border-radius:50%;background:${pc};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${(post.author_name || 'T').charAt(0)}</div>
    <div>
      <p style="font-weight:600;color:#0f172a;font-size:0.9rem;">${esc(post.author_name || 'The Team')}</p>
      <p style="color:#64748b;font-size:0.8rem;">${post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</p>
    </div>
  </div>
  <div style="color:#374151;line-height:1.8;font-family:${g.font_body || 'inherit'};">
    ${contentHtml}
  </div>
  <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #e2e8f0;">
    <a href="index.html" style="color:${pc};text-decoration:none;font-size:0.875rem;font-weight:600;">← Back to Blog</a>
  </div>
</article>`;

  return pageShell({
    title: `${post.title} | ${g.business_name}`,
    description: post.excerpt || `Read ${post.title} on the ${g.business_name} blog.`,
    primaryColor: pc,
    fontHeading: g.font_heading,
    fontBody: g.font_body,
    bodyContent: body,
    nav: renderNavForBlog(g, pages),
    footer: renderFooter(g, pages),
  });
}

// ─── README ───────────────────────────────────────────────────────────────────

function buildReadme(g: Global, premiumFeatures: string[], slug: string | null): string {
  const activeAddons = premiumFeatures.length > 0
    ? premiumFeatures.join(', ')
    : 'None';

  const addonNotes: string[] = [];
  if (premiumFeatures.includes('contact_forms'))
    addonNotes.push('- Contact Forms: The forms are exported as static HTML. Wire them up to Netlify Forms, Formspree, or a custom backend to receive submissions.');
  if (premiumFeatures.includes('blog'))
    addonNotes.push('- Blog: Blog pages are included as static HTML. Future posts will need to be generated and added manually or via a CMS.');
  if (premiumFeatures.includes('cal_com') || premiumFeatures.includes('google_calendar'))
    addonNotes.push('- Calendar Booking: The live Cal.com booking widget is not included in the static export. Add a new booking integration via your hosting platform.');
  if (premiumFeatures.includes('chat_widget') || premiumFeatures.includes('ai_chatbot'))
    addonNotes.push('- Live Chat / AI Chatbot: Chat widgets require a backend service. Re-enable these by adding a third-party chat embed (e.g., Tawk.to, Intercom) to your HTML files.');
  if (premiumFeatures.includes('ai_phone_inbound') || premiumFeatures.includes('ai_phone_outbound'))
    addonNotes.push('- AI Phone Receptionist: This feature is hosted by Custom Websites Plus and cannot be exported. Contact your new hosting provider for alternatives.');

  return `YOUR WEBSITE FILES — Custom Websites Plus
==========================================

Business: ${g.business_name}
Export date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
${slug ? `Former CWP site slug: /site/${slug}` : ''}

────────────────────────────────────────────

WHAT'S IN THIS ZIP
──────────────────
index.html          — Home page (and all other pages in subdirectories)
blog/               — Blog listing + individual post pages (if blog was active)
README.txt          — This file

────────────────────────────────────────────

HOW TO DEPLOY
─────────────

OPTION 1 — Netlify (easiest, free tier available)
  1. Go to https://www.netlify.com and sign up / log in.
  2. Click "Add new site" → "Deploy manually".
  3. Drag and drop this entire unzipped folder onto the Netlify drop zone.
  4. Your site will be live in seconds at a free *.netlify.app URL.
  5. Connect your own domain in Site Settings → Domain Management.

OPTION 2 — Vercel
  1. Install the Vercel CLI: npm i -g vercel
  2. Inside the unzipped folder, run: vercel
  3. Follow the prompts. Your site will be live at a *.vercel.app URL.

OPTION 3 — cPanel / Traditional Web Host
  1. Log in to your hosting control panel (cPanel, Plesk, etc.).
  2. Open the File Manager and navigate to public_html (or your domain's root).
  3. Upload all files from this ZIP, preserving the folder structure.
  4. Your site should be accessible at your domain immediately.

OPTION 4 — GitHub Pages
  1. Create a new GitHub repository.
  2. Push all these files to the main branch.
  3. Go to Repository Settings → Pages → Source → Deploy from branch (main, / root).
  4. Your site will be live at https://yourusername.github.io/repo-name.

────────────────────────────────────────────

ADD-ONS THAT WERE ACTIVE
─────────────────────────
${activeAddons}

${addonNotes.length > 0 ? 'NOTES ON RECONFIGURATION\n────────────────────────\n' + addonNotes.join('\n') : ''}

────────────────────────────────────────────

Need help? Your web developer can assist with deployment.
This export was generated by Custom Websites Plus (https://customwebsitesplus.com).
`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json() as { client_id?: string };
    const { client_id } = body;

    if (!client_id) return errorResponse('client_id is required.', 400);

    console.log(`[export-site-zip] Starting export for client: ${client_id}`);

    // ── 1. Fetch website brief ────────────────────────────────────────────────
    const { data: brief, error: briefErr } = await supabase
      .from('website_briefs')
      .select('website_json, client_slug, premium_features, business_name')
      .eq('client_id', client_id)
      .single();

    if (briefErr || !brief) {
      console.error('[export-site-zip] Brief fetch error:', briefErr);
      return errorResponse('No website brief found for this client.', 404);
    }

    const websiteJson = brief.website_json as WebsiteJson | null;
    if (!websiteJson || !websiteJson.global || !websiteJson.pages?.length) {
      return errorResponse('Website has not been generated yet. Please generate the site first.', 422);
    }

    const premiumFeatures: string[] = Array.isArray(brief.premium_features) ? brief.premium_features : [];
    const hasBlog = premiumFeatures.includes('blog');

    // ── 2. Fetch blog posts (if blog feature is active) ───────────────────────
    let blogPosts: BlogPost[] = [];
    if (hasBlog) {
      const { data: posts, error: postsErr } = await supabase
        .from('blog_posts')
        .select('id,title,slug,excerpt,content,author_name,published_at,featured_image_url,category')
        .eq('client_id', client_id)
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (postsErr) {
        console.warn('[export-site-zip] Blog posts fetch warning:', postsErr);
      } else {
        blogPosts = (posts || []) as BlogPost[];
      }
    }

    // ── 3. Build ZIP ──────────────────────────────────────────────────────────
    const { global: g, pages } = websiteJson;
    const zip = new JSZip();

    // Home page (index.html)
    const homePage = pages.find(p => p.slug === '' || p.id === 'home') ?? pages[0];
    const homeBody = homePage.sections.map(s => renderSection(s, g)).join('\n');
    zip.file('index.html', pageShell({
      title: g.business_name,
      description: `Welcome to ${g.business_name}`,
      primaryColor: g.primary_color,
      fontHeading: g.font_heading,
      fontBody: g.font_body,
      bodyContent: homeBody,
      nav: renderNav(g, pages, ''),
      footer: renderFooter(g, pages),
    }));

    // Additional pages (about, services, contact, etc.)
    for (const page of pages) {
      if (page.slug === '' || page.id === 'home') continue;
      const pageBody = page.sections.map(s => renderSection(s, g)).join('\n');
      const nav = renderNav(g, pages, page.slug).replace(
        /href="([\w-]+\/index\.html)"/g,
        (_, href) => `href="../${href}"`
      ).replace(/href="index\.html"/g, 'href="../index.html"');
      const footer = renderFooter(g, pages);
      zip.file(`${page.slug}/index.html`, pageShell({
        title: `${page.name} | ${g.business_name}`,
        primaryColor: g.primary_color,
        fontHeading: g.font_heading,
        fontBody: g.font_body,
        bodyContent: pageBody,
        nav,
        footer,
      }));
    }

    // Blog pages
    if (hasBlog) {
      zip.file('blog/index.html', buildBlogIndex(blogPosts, g, pages, '../'));
      for (const post of blogPosts) {
        zip.file(`blog/${post.slug}.html`, buildBlogPost(post, g, pages));
      }
    }

    // README
    zip.file('README.txt', buildReadme(g, premiumFeatures, brief.client_slug));

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    console.log(`[export-site-zip] ZIP generated: ${zipBuffer.byteLength} bytes`);

    // ── 4. Upload to Supabase Storage ─────────────────────────────────────────
    const storagePath = `${client_id}/site-export.zip`;
    const { error: uploadErr } = await supabase.storage
      .from('site-exports')
      .upload(storagePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadErr) {
      console.error('[export-site-zip] Upload error:', uploadErr);
      return errorResponse(`Storage upload failed: ${uploadErr.message}`, 500);
    }

    // ── 5. Create signed URL (24 hours) ───────────────────────────────────────
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('site-exports')
      .createSignedUrl(storagePath, 60 * 60 * 24);

    if (signedErr || !signedData?.signedUrl) {
      console.error('[export-site-zip] Signed URL error:', signedErr);
      return errorResponse('Failed to generate download URL.', 500);
    }

    console.log(`[export-site-zip] Export complete for client: ${client_id}`);

    return jsonResponse({
      success: true,
      download_url: signedData.signedUrl,
      file_size_bytes: zipBuffer.byteLength,
      pages_exported: pages.length,
      blog_posts_exported: blogPosts.length,
      expires_at: new Date(Date.now() + 60 * 60 * 24 * 1000).toISOString(),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[export-site-zip] Unhandled error:', message);
    return errorResponse(`Export failed: ${message}`, 500);
  }
});
