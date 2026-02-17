import React from 'react';
import { Phone, MapPin } from 'lucide-react';
import { WebsiteGlobal, WebsitePage } from '../../types/website';

interface SiteFooterProps {
  global: WebsiteGlobal;
  pages: WebsitePage[];
  siteSlug: string;
}

const SiteFooter: React.FC<SiteFooterProps> = ({ global: g, pages, siteSlug }) => {
  const year = new Date().getFullYear();

  const getHref = (page: WebsitePage) =>
    page.slug === '' ? `/site/${siteSlug}` : `/site/${siteSlug}/${page.slug}`;

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* Brand column */}
          <div>
            {g.logo_url && (
              <img
                src={g.logo_url}
                alt={g.business_name}
                className="h-10 w-auto object-contain mb-3 brightness-0 invert"
              />
            )}
            <span
              className="text-lg font-bold text-white block mb-3"
              style={{ fontFamily: g.font_heading }}
            >
              {g.business_name}
            </span>
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

          {/* Navigation links */}
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

          {/* Quick contact */}
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

        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <span>&copy; {year} {g.business_name}. All rights reserved.</span>
          <span>Website by <span style={{ color: g.primary_color }}>CWP</span></span>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
