import React from 'react';
import { SectionComponentProps } from '../../../types/website';

// ─── Solid ────────────────────────────────────────────────────────────────────
const CTASolid: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => (
  <section className="py-16 px-4" style={{ backgroundColor: style_overrides?.background || g.primary_color }}>
    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-white text-center md:text-left">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="opacity-85 text-lg" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
      </div>
      {content.button_text && (
        <a
          href={content.button_url || '#contact'}
          className="shrink-0 inline-block px-8 py-4 rounded-xl bg-white font-bold text-lg shadow-lg transition-transform hover:scale-105"
          style={{ color: g.primary_color }}
        >
          {content.button_text}
        </a>
      )}
    </div>
  </section>
);

// ─── Gradient ────────────────────────────────────────────────────────────────
const CTAGradient: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 text-center text-white" style={{ background: `linear-gradient(135deg, ${g.primary_color} 0%, ${g.secondary_color || '#6366f1'} 100%)` }}>
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: g.font_heading }}>
        {content.heading}
      </h2>
      {content.subtext && (
        <p className="text-xl opacity-85 mb-8" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
      )}
      {content.button_text && (
        <a href={content.button_url || '#contact'} className="inline-block px-10 py-4 rounded-2xl bg-white font-bold text-lg shadow-2xl transition-transform hover:scale-105" style={{ color: g.primary_color }}>
          {content.button_text}
        </a>
      )}
    </div>
  </section>
);

// ─── Image Background ─────────────────────────────────────────────────────────
const CTAImageBg: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 text-center text-white relative overflow-hidden min-h-60 flex items-center">
    {content.background_image_url && (
      <>
        <div className="absolute inset-0 z-0">
          <img src={content.background_image_url} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 z-0 bg-slate-900/65" />
      </>
    )}
    {!content.background_image_url && (
      <div className="absolute inset-0 z-0" style={{ backgroundColor: g.primary_color }} />
    )}
    <div className="max-w-3xl mx-auto relative z-10">
      <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: g.font_heading }}>
        {content.heading}
      </h2>
      {content.subtext && (
        <p className="text-xl opacity-85 mb-8" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
      )}
      {content.button_text && (
        <a href={content.button_url || '#contact'} className="inline-block px-10 py-4 rounded-xl text-white font-bold text-lg shadow-xl transition-transform hover:scale-105 border-2 border-white hover:bg-white/15">
          {content.button_text}
        </a>
      )}
    </div>
  </section>
);

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const CTABannerSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'solid';
  const allProps = { content, ...props };

  if (v === 'gradient')  return <CTAGradient {...allProps} />;
  if (v === 'image_bg')  return <CTAImageBg {...allProps} />;
  return <CTASolid {...allProps} />;
};

export default CTABannerSection;
