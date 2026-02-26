import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { CheckCircle, ChevronDown } from 'lucide-react';

const ServicesCards: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-6xl mx-auto">
      <h2
        className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {(content.services || []).map((svc: any, i: number) => (
          <div
            key={i}
            className="p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-lg"
              style={{ backgroundColor: g.primary_color }}
            >
              {svc.name?.charAt(0) || '★'}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: g.font_heading }}>
              {svc.name}
            </h3>
            <p className="text-slate-600 text-sm" style={{ fontFamily: g.font_body }}>
              {svc.description}
            </p>
            {(svc.cta_text || svc.cta_link) && (
              <a
                href={svc.cta_link || '#contact'}
                className="inline-flex items-center gap-1 text-sm font-semibold mt-4 transition-opacity hover:opacity-75"
                style={{ color: g.primary_color }}
              >
                {svc.cta_text || 'Learn More'} →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ServicesIconList: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4" style={{ backgroundColor: `${g.primary_color}08` }}>
    <div className="max-w-4xl mx-auto">
      <h2
        className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(content.services || []).map((svc: any, i: number) => (
          <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm">
            <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: g.primary_color }} />
            <div>
              <p className="font-semibold text-slate-900" style={{ fontFamily: g.font_heading }}>
                {svc.name}
              </p>
              <p className="text-slate-600 text-sm mt-0.5" style={{ fontFamily: g.font_body }}>
                {svc.description}
              </p>
              {(svc.cta_text || svc.cta_link) && (
                <a
                  href={svc.cta_link || '#contact'}
                  className="inline-flex items-center gap-1 text-sm font-semibold mt-2 transition-opacity hover:opacity-75"
                  style={{ color: g.primary_color }}
                >
                  {svc.cta_text || 'Learn More'} →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ServicesAccordion: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10 text-center"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
        <div className="space-y-3">
          {(content.services || []).map((svc: any, i: number) => (
            <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                style={{ fontFamily: g.font_heading }}
              >
                <span>{svc.name}</span>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${open === i ? 'rotate-180' : ''}`}
                  style={{ color: g.primary_color }}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-slate-600 text-sm" style={{ fontFamily: g.font_body }}>
                  {svc.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ServicesSection: React.FC<SectionComponentProps & { variant: string }> = ({ variant, ...props }) => {
  if (variant === 'icon_list') return <ServicesIconList {...props} />;
  if (variant === 'accordion') return <ServicesAccordion {...props} />;
  return <ServicesCards {...props} />;
};

export default ServicesSection;
