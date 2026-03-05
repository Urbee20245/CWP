import React from 'react';
import { Phone, MapPin, Lock } from 'lucide-react';
import { WebsiteGlobal, WebsitePage } from '../../types/website';

interface SiteFooterProps {
  global: WebsiteGlobal;
  pages: WebsitePage[];
  siteSlug: string;
  customDomain?: boolean;
}

const SiteFooter: React.FC<SiteFooterProps> = ({ global: g, pages, siteSlug, customDomain }) => {
  const year = new Date().getFullYear();

  const getHref = (page: WebsitePage) => {
    if (customDomain) return page.slug === '' ? '/' : `/${page.slug}`;
    return page.slug === '' ? `/site/${siteSlug}` : `/site/${siteSlug}/${page.slug}`;
  };

  const footerLinks = g.footer_links ?? [];
  const serviceAreas = g.service_areas ?? [];
  const hasExtraColumns = footerLinks.length > 0 || serviceAreas.length > 0;

  // Determine grid columns: brand + nav always; add links col and/or areas col dynamically
  const colCount =
    1 /* brand */ +
    1 /* nav */   +
    (footerLinks.length > 0 ? 1 : 0) +
    (serviceAreas.length > 0 ? 1 : 0) +
    1 /* get in touch */;

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-10"
          style={{ gridTemplateColumns: `repeat(${Math.min(colCount, 4)}, minmax(0, 1fr))` }}
        >
          {/* ── Brand column ─────────────────────────────────────────────── */}
          <div>
            {g.logo_url && (
              <img
                src={g.logo_url}
                alt={g.business_name}
                className="h-10 w-auto object-contain mb-3 brightness-0 invert"
              />
            )}
            <span
              className="text-lg font-bold text-white block mb-1"
              style={{ fontFamily: g.font_heading }}
            >
              {g.business_name}
            </span>
            {g.footer_tagline && (
              <p className="text-sm text-slate-400 mb-3 italic">{g.footer_tagline}</p>
            )}
            {g.address && (
              <p className="flex items-start gap-2 text-sm mb-2">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: g.primary_color }} />
                {g.address}
              </p>
            )}
            {g.phone && (
              <a
                href={`tel:${g.phone.replace(/\D/g, '')}`}
                className="flex items-center gap-2 text-sm hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 flex-shrink-0" style={{ color: g.primary_color }} />
                {g.phone}
              </a>
            )}
          </div>

          {/* ── Navigation column ────────────────────────────────────────── */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Navigation</h3>
            <ul className="space-y-2">
              {pages.map(page => (
                <li key={page.id}>
                  <a
                    href={getHref(page)}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {page.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Footer links column (optional) ───────────────────────────── */}
          {footerLinks.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Links</h3>
              <ul className="space-y-2">
                {footerLinks.map((link, i) => {
                  const isLogin = /login|sign.?in|portal/i.test(link.label);
                  return (
                    <li key={i}>
                      <a
                        href={link.url}
                        target={link.target || '_self'}
                        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {isLogin && <Lock className="w-3 h-3 flex-shrink-0" style={{ color: g.primary_color }} />}
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ── Service areas column (optional) ──────────────────────────── */}
          {serviceAreas.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Service Areas</h3>
              <ul className="space-y-2">
                {serviceAreas.map((area, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: g.primary_color }} />
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Get in touch column ───────────────────────────────────────── */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Get In Touch</h3>
            {g.phone && (
              <a
                href={`tel:${g.phone.replace(/\D/g, '')}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: g.primary_color }}
              >
                <Phone className="w-4 h-4" />
                Call Us Now
              </a>
            )}
            {g.address && (
              <p className="text-slate-500 text-xs mt-4">{g.address}</p>
            )}
          </div>
        </div>

        {/* ── Bottom bar ───────────────────────────────────────────────────── */}
        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <span>&copy; {year} {g.business_name}. All rights reserved.</span>
          <div className="flex items-center gap-4">
            {g.staff_login_url && (
              <a
                href={g.staff_login_url}
                className="flex items-center gap-1 hover:text-slate-400 transition-colors"
              >
                <Lock className="w-3 h-3" />
                Staff Login
              </a>
            )}
            <span>Website by <span style={{ color: g.primary_color }}>CWP</span></span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
