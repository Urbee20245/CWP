import React from 'react';
import { Phone } from 'lucide-react';
import { WebsiteGlobal } from '../../types/website';

interface SiteHeaderProps {
  global: WebsiteGlobal;
}

const SiteHeader: React.FC<SiteHeaderProps> = ({ global: g }) => {
  return (
    <header
      className="sticky top-0 z-50 bg-white shadow-sm"
      style={{ borderBottom: `3px solid ${g.primary_color}` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <span
          className="text-xl font-bold"
          style={{ color: g.primary_color, fontFamily: g.font_heading }}
        >
          {g.business_name}
        </span>

        {g.phone && (
          <a
            href={`tel:${g.phone.replace(/\D/g, '')}`}
            className="flex items-center gap-2 font-semibold text-sm sm:text-base transition-opacity hover:opacity-80"
            style={{ color: g.primary_color }}
          >
            <Phone className="w-4 h-4" />
            {g.phone}
          </a>
        )}
      </div>
    </header>
  );
};

export default SiteHeader;
