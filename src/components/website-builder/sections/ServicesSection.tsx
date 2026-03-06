import React, { useState } from 'react';
import { SectionComponentProps } from '../../../types/website';
import { CheckCircle, ChevronDown } from 'lucide-react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

// ─── Helper: render icon for a service item ────────────────────────────────────
const ServiceIcon: React.FC<{ svc: any; color: string; size?: number }> = ({ svc, color, size = 32 }) => {
  if (svc.icon_name) {
    return <Icon icon={svc.icon_name} width={size} height={size} style={{ color }} />;
  }
  return (
    <span className="font-bold text-lg" style={{ color }}>
      {svc.name?.charAt(0) || '★'}
    </span>
  );
};

// ─── Grid (default, existing) ──────────────────────────────────────────────────
const ServicesCards: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12" style={{ fontFamily: g.font_heading }}>
        {content.heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {(content.services || []).map((svc: any, i: number) => (
          <div key={i} className="p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-lg" style={{ backgroundColor: g.primary_color }}>
              <ServiceIcon svc={svc} color="#fff" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: g.font_heading }}>
              {svc.name}
            </h3>
            <p className="text-slate-600 text-sm" style={{ fontFamily: g.font_body }}>
              {svc.description}
            </p>
            {(svc.cta_text || svc.cta_link) && (
              <a href={svc.cta_link || '#contact'} className="inline-flex items-center gap-1 text-sm font-semibold mt-4 transition-opacity hover:opacity-75" style={{ color: g.primary_color }}>
                {svc.cta_text || 'Learn More'} →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Cards (tall with hover lift via framer-motion) ────────────────────────────
const ServicesHoverCards: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4" style={{ backgroundColor: `${g.primary_color}06` }}>
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12" style={{ fontFamily: g.font_heading }}>
        {content.heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {(content.services || []).map((svc: any, i: number) => (
          <motion.div
            key={i}
            whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm cursor-default flex flex-col"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: `${g.primary_color}15` }}>
              <ServiceIcon svc={svc} color={g.primary_color} size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: g.font_heading }}>
              {svc.name}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed flex-1" style={{ fontFamily: g.font_body }}>
              {svc.description}
            </p>
            {(svc.cta_text || svc.cta_link) && (
              <a href={svc.cta_link || '#contact'} className="inline-flex items-center gap-1 text-sm font-semibold mt-5 transition-opacity hover:opacity-75" style={{ color: g.primary_color }}>
                {svc.cta_text || 'Learn More'} →
              </a>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Icons Grid (large icon above text, centered) ─────────────────────────────
const ServicesIconsGrid: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12" style={{ fontFamily: g.font_heading }}>
        {content.heading}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
        {(content.services || []).map((svc: any, i: number) => (
          <div key={i} className="text-center group">
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors"
              style={{ backgroundColor: `${g.primary_color}12` }}
            >
              <ServiceIcon svc={svc} color={g.primary_color} size={40} />
            </motion.div>
            <h3 className="text-base font-bold text-slate-900 mb-1" style={{ fontFamily: g.font_heading }}>
              {svc.name}
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed" style={{ fontFamily: g.font_body }}>
              {svc.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── List (horizontal rows, icon + text) ─────────────────────────────────────
const ServicesListView: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4" style={{ backgroundColor: `${g.primary_color}08` }}>
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10" style={{ fontFamily: g.font_heading }}>
        {content.heading}
      </h2>
      <div className="space-y-4">
        {(content.services || []).map((svc: any, i: number) => (
          <div key={i} className="flex items-center gap-5 p-5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${g.primary_color}15` }}>
              <ServiceIcon svc={svc} color={g.primary_color} size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900" style={{ fontFamily: g.font_heading }}>{svc.name}</p>
              <p className="text-slate-600 text-sm mt-0.5 truncate" style={{ fontFamily: g.font_body }}>{svc.description}</p>
            </div>
            {(svc.cta_text || svc.cta_link) && (
              <a href={svc.cta_link || '#contact'} className="shrink-0 text-sm font-semibold transition-opacity hover:opacity-75" style={{ color: g.primary_color }}>
                {svc.cta_text || 'Learn More'} →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Icon List (legacy) ───────────────────────────────────────────────────────
const ServicesIconList: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4" style={{ backgroundColor: `${g.primary_color}08` }}>
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10" style={{ fontFamily: g.font_heading }}>
        {content.heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(content.services || []).map((svc: any, i: number) => (
          <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm">
            <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: g.primary_color }} />
            <div>
              <p className="font-semibold text-slate-900" style={{ fontFamily: g.font_heading }}>{svc.name}</p>
              <p className="text-slate-600 text-sm mt-0.5" style={{ fontFamily: g.font_body }}>{svc.description}</p>
              {(svc.cta_text || svc.cta_link) && (
                <a href={svc.cta_link || '#contact'} className="inline-flex items-center gap-1 text-sm font-semibold mt-2 transition-opacity hover:opacity-75" style={{ color: g.primary_color }}>
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const ServicesTabs: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const services: any[] = content.services || [];
  const [activeTab, setActiveTab] = useState(0);
  const active = services[activeTab];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-10" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        {/* Tab buttons */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {services.map((svc, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: activeTab === i ? g.primary_color : `${g.primary_color}10`,
                color: activeTab === i ? '#fff' : g.primary_color,
              }}
            >
              {svc.name}
            </button>
          ))}
        </div>
        {/* Tab content */}
        {active && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-2xl border"
            style={{ borderColor: `${g.primary_color}20` }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${g.primary_color}12` }}>
              <ServiceIcon svc={active} color={g.primary_color} size={36} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3" style={{ fontFamily: g.font_heading }}>
                {active.name}
              </h3>
              <p className="text-slate-600 leading-relaxed" style={{ fontFamily: g.font_body }}>
                {active.description}
              </p>
              {(active.cta_text || active.cta_link) && (
                <a href={active.cta_link || '#contact'} className="inline-flex items-center gap-1 text-sm font-semibold mt-5 transition-opacity hover:opacity-75" style={{ color: g.primary_color }}>
                  {active.cta_text || 'Learn More'} →
                </a>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
};

// ─── Accordion ────────────────────────────────────────────────────────────────
const ServicesAccordion: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10 text-center" style={{ fontFamily: g.font_heading }}>
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
                <div className="flex items-center gap-3">
                  <ServiceIcon svc={svc} color={g.primary_color} size={20} />
                  <span>{svc.name}</span>
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${open === i ? 'rotate-180' : ''}`} style={{ color: g.primary_color }} />
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

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const ServicesSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'grid';
  const allProps = { content, ...props };

  if (v === 'icon_list')  return <ServicesIconList {...allProps} />;
  if (v === 'accordion')  return <ServicesAccordion {...allProps} />;
  if (v === 'cards')      return <ServicesHoverCards {...allProps} />;
  if (v === 'icons_grid') return <ServicesIconsGrid {...allProps} />;
  if (v === 'list')       return <ServicesListView {...allProps} />;
  if (v === 'tabs')       return <ServicesTabs {...allProps} />;
  return <ServicesCards {...allProps} />;
};

export default ServicesSection;
