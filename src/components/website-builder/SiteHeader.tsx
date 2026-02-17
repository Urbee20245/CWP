import React, { useState, useEffect } from 'react';
import { Phone, Menu, X } from 'lucide-react';
import { WebsiteGlobal, WebsitePage } from '../../types/website';

interface SiteHeaderProps {
  global: WebsiteGlobal;
  pages: WebsitePage[];
  siteSlug: string;
  currentPageId: string;
}

const SiteHeader: React.FC<SiteHeaderProps> = ({ global: g, pages, siteSlug, currentPageId }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [currentPageId]);

  const getHref = (page: WebsitePage) => {
    if (page.slug === '') return `/site/${siteSlug}`;
    return `/site/${siteSlug}/${page.slug}`;
  };

  // Pages that appear in nav (all of them)
  const navPages = pages;

  const navLinkClass = (pageId: string) =>
    `relative text-sm font-medium transition-colors duration-150 ${
      currentPageId === pageId
        ? 'font-semibold'
        : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-shadow duration-200 ${
          scrolled ? 'shadow-md' : 'shadow-sm'
        }`}
        style={{ backgroundColor: '#ffffff', borderBottom: `3px solid ${g.primary_color}` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Business Name */}
            <a
              href={`/site/${siteSlug}`}
              className="flex items-center gap-3 min-w-0 flex-shrink-0"
            >
              {g.logo_url ? (
                <img
                  src={g.logo_url}
                  alt={g.business_name}
                  className="h-9 w-auto object-contain"
                />
              ) : null}
              <span
                className="text-xl font-bold truncate"
                style={{ color: g.primary_color, fontFamily: g.font_heading }}
              >
                {g.business_name}
              </span>
            </a>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {navPages.map(page => (
                <a
                  key={page.id}
                  href={getHref(page)}
                  className={navLinkClass(page.id)}
                  style={currentPageId === page.id ? { color: g.primary_color } : {}}
                >
                  <span className="px-3 py-2 rounded-lg hover:bg-slate-50 block">
                    {page.name}
                  </span>
                  {currentPageId === page.id && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                      style={{ backgroundColor: g.primary_color }}
                    />
                  )}
                </a>
              ))}
            </nav>

            {/* CTA + mobile toggle */}
            <div className="flex items-center gap-3">
              {g.phone && (
                <a
                  href={`tel:${g.phone.replace(/\D/g, '')}`}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: g.primary_color }}
                >
                  <Phone className="w-3.5 h-3.5" />
                  {g.phone}
                </a>
              )}

              {/* Mobile hamburger */}
              <button
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => setMobileOpen(o => !o)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-x-0 top-[67px] z-40 bg-white border-b border-slate-200 shadow-xl"
          style={{ borderTop: `2px solid ${g.primary_color}` }}
        >
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {navPages.map(page => (
              <a
                key={page.id}
                href={getHref(page)}
                className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  currentPageId === page.id
                    ? 'font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                style={currentPageId === page.id ? { color: g.primary_color, backgroundColor: `${g.primary_color}10` } : {}}
              >
                {page.name}
              </a>
            ))}
            {g.phone && (
              <a
                href={`tel:${g.phone.replace(/\D/g, '')}`}
                className="flex items-center justify-center gap-2 mt-3 px-4 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: g.primary_color }}
              >
                <Phone className="w-4 h-4" />
                Call {g.phone}
              </a>
            )}
          </nav>
        </div>
      )}
    </>
  );
};

export default SiteHeader;
