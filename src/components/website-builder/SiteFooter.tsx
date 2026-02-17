import React from 'react';
import { Phone, MapPin } from 'lucide-react';
import { WebsiteGlobal } from '../../types/website';

interface SiteFooterProps {
  global: WebsiteGlobal;
}

const SiteFooter: React.FC<SiteFooterProps> = ({ global: g }) => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <span
              className="text-lg font-bold text-white block mb-2"
              style={{ fontFamily: g.font_heading }}
            >
              {g.business_name}
            </span>
            {g.address && (
              <p className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: g.primary_color }} />
                {g.address}
              </p>
            )}
            {g.phone && (
              <a
                href={`tel:${g.phone.replace(/\D/g, '')}`}
                className="flex items-center gap-2 text-sm mt-1 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 flex-shrink-0" style={{ color: g.primary_color }} />
                {g.phone}
              </a>
            )}
          </div>

          <div className="text-sm text-slate-500 self-end">
            &copy; {year} {g.business_name}. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
