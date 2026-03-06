import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { MapPin, Phone, Clock } from 'lucide-react';

// Build an OpenStreetMap embed URL from lat/lng or just show address text
const MapEmbed: React.FC<{ lat?: number; lng?: number; zoom?: number; address?: string; height?: string }> = ({
  lat, lng, zoom = 15, address, height = 'h-80',
}) => {
  if (lat && lng) {
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.01},${lng + 0.02},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
    return (
      <iframe
        src={src}
        className={`w-full ${height} border-0`}
        title="Map"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }
  if (address) {
    const encoded = encodeURIComponent(address);
    const src = `https://www.openstreetmap.org/export/embed.html?query=${encoded}&layer=mapnik`;
    return (
      <iframe
        src={src}
        className={`w-full ${height} border-0`}
        title="Map"
        loading="lazy"
      />
    );
  }
  return (
    <div className={`w-full ${height} bg-slate-200 flex items-center justify-center text-slate-400 text-sm`}>
      No location provided — add lat/lng or address
    </div>
  );
};

// ─── Full Width ────────────────────────────────────────────────────────────────
const MapFullWidth: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-0 overflow-hidden">
    {(content.title || content.heading) && (
      <div className="py-10 px-4 text-center bg-white">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900" style={{ fontFamily: g.font_heading }}>
          {content.title || content.heading}
        </h2>
        {content.address && <p className="text-slate-600 mt-2">{content.address}</p>}
      </div>
    )}
    <div className="rounded-none">
      <MapEmbed lat={content.lat} lng={content.lng} zoom={content.zoom} address={content.address} height="h-[500px]" />
    </div>
  </section>
);

// ─── Split (map left, info right) ─────────────────────────────────────────────
const MapSplit: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-0 overflow-hidden">
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[480px]">
      <div className="lg:order-none">
        <MapEmbed lat={content.lat} lng={content.lng} zoom={content.zoom} address={content.address || g.address} height="h-full min-h-[360px]" />
      </div>
      <div className="bg-white p-10 flex flex-col justify-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-6" style={{ fontFamily: g.font_heading }}>
          {content.title || content.heading || 'Find Us'}
        </h2>
        {(content.address || g.address) && (
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: g.primary_color }} />
            <p className="text-slate-600">{content.address || g.address}</p>
          </div>
        )}
        {g.phone && (
          <div className="flex items-center gap-3 mb-4">
            <Phone className="w-5 h-5 shrink-0" style={{ color: g.primary_color }} />
            <a href={`tel:${g.phone.replace(/\D/g, '')}`} className="text-slate-600 hover:underline">{g.phone}</a>
          </div>
        )}
        {content.hours && (
          <div className="flex items-start gap-3 mb-4">
            <Clock className="w-5 h-5 mt-0.5 shrink-0" style={{ color: g.primary_color }} />
            <p className="text-slate-600 whitespace-pre-line">{content.hours}</p>
          </div>
        )}
        {(content.address || g.address) && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(content.address || g.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 w-fit"
            style={{ backgroundColor: g.primary_color }}
          >
            Get Directions
          </a>
        )}
      </div>
    </div>
  </section>
);

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const MapSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'split';
  const allProps = { content, ...props };

  if (v === 'full_width') return <MapFullWidth {...allProps} />;
  return <MapSplit {...allProps} />;
};

export default MapSection;
