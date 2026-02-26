import React from 'react';
import { SectionComponentProps } from '../../../types/website';

const HeroCenteredCta: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section
    className="py-24 px-4 text-center relative overflow-hidden"
    style={{
      background: content.background_image_url
        ? 'transparent'
        : content.background_style === 'dark'
          ? '#1e293b'
          : content.background_style === 'light'
            ? '#f8fafc'
            : `linear-gradient(135deg, ${g.primary_color}22 0%, ${g.primary_color}08 100%)`,
      color: content.background_style === 'dark' || content.background_image_url ? '#f1f5f9' : '#0f172a',
    }}
  >
    {content.background_image_url && (
      <>
        <div className="absolute inset-0 z-0">
          <img src={content.background_image_url} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 z-0 bg-slate-900/60" />
      </>
    )}
    <div className="max-w-3xl mx-auto relative z-10">
      {content.badge_text && (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-white/10 text-white border border-white/20">
          {content.badge_text}
        </span>
      )}
      <h1
        className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight"
        style={{ fontFamily: g.font_heading }}
      >
        {content.headline}
      </h1>
      <p className="text-xl mb-10 opacity-80" style={{ fontFamily: g.font_body }}>
        {content.subheadline}
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {content.cta_primary_text && (
          <a
            href={content.cta_primary_link || '#contact'}
            className="inline-block px-8 py-4 rounded-xl text-white text-lg font-semibold shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: g.primary_color }}
          >
            {content.cta_primary_text}
          </a>
        )}
        {content.cta_secondary_text && (
          <a
            href={content.cta_secondary_link || '#contact'}
            className="inline-block px-8 py-4 rounded-xl text-lg font-semibold bg-white/10 border border-white/30 text-white hover:bg-white/20 transition-colors"
          >
            {content.cta_secondary_text}
          </a>
        )}
      </div>
    </div>
  </section>
);

const HeroSplitImageLeft: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-16 px-4 bg-white">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div className="h-80 lg:h-[500px] rounded-2xl overflow-hidden">
        {content.image_url ? (
          <img
            src={content.image_url}
            alt={content.headline || g.business_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-4xl font-bold"
            style={{ backgroundColor: `${g.primary_color}22`, color: g.primary_color }}
          >
            {g.business_name.charAt(0)}
          </div>
        )}
      </div>
      <div>
        {content.badge_text && (
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
            style={{ backgroundColor: `${g.primary_color}15`, color: g.primary_color }}
          >
            {content.badge_text}
          </span>
        )}
        <h1
          className="text-4xl sm:text-5xl font-extrabold mb-6 leading-tight text-slate-900"
          style={{ fontFamily: g.font_heading }}
        >
          {content.headline}
        </h1>
        <p className="text-xl text-slate-600 mb-6" style={{ fontFamily: g.font_body }}>
          {content.subheadline}
        </p>
        {Array.isArray(content.trust_badges) && content.trust_badges.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-8">
            {content.trust_badges.map((badge: string, i: number) => (
              <span key={i} className="flex items-center gap-1.5 text-sm text-slate-600 font-medium">
                <span style={{ color: g.primary_color }}>✓</span> {badge}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          {content.cta_primary_text && (
            <a
              href={content.cta_primary_link || '#contact'}
              className="inline-block px-8 py-4 rounded-xl text-white text-lg font-semibold shadow-lg transition-transform hover:scale-105"
              style={{ backgroundColor: g.primary_color }}
            >
              {content.cta_primary_text}
            </a>
          )}
          {content.cta_secondary_text && (
            <a
              href={content.cta_secondary_link || '#contact'}
              className="inline-block px-8 py-4 rounded-xl text-lg font-semibold border-2 transition-colors hover:bg-slate-50"
              style={{ borderColor: g.primary_color, color: g.primary_color }}
            >
              {content.cta_secondary_text}
            </a>
          )}
        </div>
      </div>
    </div>
  </section>
);

const HeroBoldStatement: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section
    className="py-28 px-4 text-center text-white relative overflow-hidden"
    style={{ backgroundColor: g.primary_color }}
  >
    <div className="max-w-4xl mx-auto relative z-10">
      <h1
        className="text-5xl sm:text-6xl lg:text-7xl font-black mb-6 leading-none uppercase tracking-tight"
        style={{ fontFamily: g.font_heading }}
      >
        {content.headline}
      </h1>
      <p className="text-xl sm:text-2xl mb-10 opacity-90" style={{ fontFamily: g.font_body }}>
        {content.subheadline}
      </p>
      {content.cta_primary_text && (
        <a
          href={content.cta_primary_link || '#contact'}
          className="inline-block px-10 py-4 rounded-xl bg-white text-lg font-bold shadow-2xl transition-transform hover:scale-105"
          style={{ color: g.primary_color }}
        >
          {content.cta_primary_text}
        </a>
      )}
    </div>
  </section>
);

const HeroSection: React.FC<SectionComponentProps & { variant: string }> = ({ variant, ...props }) => {
  if (variant === 'split_image_left') return <HeroSplitImageLeft {...props} />;
  if (variant === 'bold_statement') return <HeroBoldStatement {...props} />;
  return <HeroCenteredCta {...props} />;
};

export default HeroSection;
