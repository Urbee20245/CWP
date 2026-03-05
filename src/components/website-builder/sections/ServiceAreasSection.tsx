/**
 * ServiceAreasSection — dedicated component for section_type: "service_areas"
 * Renders a clean grid of location badges with pin icons.
 */
import React from 'react';
import { MapPin } from 'lucide-react';

interface ServiceAreasSectionProps {
  content: {
    heading?: string;
    subtext?: string;
    areas?: string[];
    [key: string]: any;
  };
  global: {
    primary_color: string;
    font_heading?: string;
    [key: string]: any;
  };
  variant?: string;
  style_overrides?: Record<string, any>;
  [key: string]: any;
}

const ServiceAreasSection: React.FC<ServiceAreasSectionProps> = ({ content, global: g, style_overrides }) => {
  const primary = g.primary_color || '#4F46E5';
  const heading = content.heading || 'Service Areas';
  const subtext = content.subtext || '';
  const areas: string[] = Array.isArray(content.areas) ? content.areas : [];

  const bg = style_overrides?.background || '#f8fafc';

  return (
    <section style={{ backgroundColor: bg, padding: style_overrides?.padding || '5rem 0' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2
          className="text-3xl sm:text-4xl font-bold mb-3"
          style={{ fontFamily: g.font_heading, color: primary }}
        >
          {heading}
        </h2>
        {subtext && (
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">{subtext}</p>
        )}

        {areas.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {areas.map((area, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-medium text-sm shadow-sm"
                style={{ backgroundColor: primary }}
              >
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {area}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 italic">No service areas listed yet.</p>
        )}
      </div>
    </section>
  );
};

export default ServiceAreasSection;
