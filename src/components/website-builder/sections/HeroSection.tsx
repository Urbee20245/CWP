import React, { useEffect, useRef, useState } from 'react';
import { SectionComponentProps } from '../../../types/website';
import { motion } from 'framer-motion';

// ─── Shared CTA buttons ────────────────────────────────────────────────────────
const HeroButtons: React.FC<{ content: any; primary_color: string }> = ({ content, primary_color }) => (
  <div className="flex flex-col sm:flex-row gap-4">
    {content.cta_primary_text && (
      <a
        href={content.cta_primary_link || '#contact'}
        className="inline-block px-8 py-4 rounded-xl text-white text-lg font-semibold shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: primary_color }}
      >
        {content.cta_primary_text}
      </a>
    )}
    {content.cta_secondary_text && (
      <a
        href={content.cta_secondary_link || '#contact'}
        className="inline-block px-8 py-4 rounded-xl text-lg font-semibold border-2 transition-colors hover:bg-white/10"
        style={{ borderColor: primary_color, color: primary_color }}
      >
        {content.cta_secondary_text}
      </a>
    )}
  </div>
);

// ─── Centered (default) ────────────────────────────────────────────────────────
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
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ fontFamily: g.font_heading }}>
        {content.headline}
      </h1>
      <p className="text-xl mb-10 opacity-80" style={{ fontFamily: g.font_body }}>
        {content.subheadline}
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {content.cta_primary_text && (
          <a href={content.cta_primary_link || '#contact'} className="inline-block px-8 py-4 rounded-xl text-white text-lg font-semibold shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: g.primary_color }}>
            {content.cta_primary_text}
          </a>
        )}
        {content.cta_secondary_text && (
          <a href={content.cta_secondary_link || '#contact'} className="inline-block px-8 py-4 rounded-xl text-lg font-semibold bg-white/10 border border-white/30 text-white hover:bg-white/20 transition-colors">
            {content.cta_secondary_text}
          </a>
        )}
      </div>
    </div>
  </section>
);

// ─── Split Left (text left, image right) ─────────────────────────────────────
const HeroSplitLeft: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-16 px-4 bg-white">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {content.badge_text && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ backgroundColor: `${g.primary_color}15`, color: g.primary_color }}>
            {content.badge_text}
          </span>
        )}
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-6 leading-tight text-slate-900" style={{ fontFamily: g.font_heading }}>
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
        <HeroButtons content={content} primary_color={g.primary_color} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
        className="h-80 lg:h-[500px] rounded-2xl overflow-hidden"
      >
        {content.image_url ? (
          <img src={content.image_url} alt={content.headline || g.business_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl font-bold" style={{ backgroundColor: `${g.primary_color}22`, color: g.primary_color }}>
            {g.business_name.charAt(0)}
          </div>
        )}
      </motion.div>
    </div>
  </section>
);

// ─── Split Right (image left, text right) ─────────────────────────────────────
const HeroSplitRight: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-16 px-4 bg-white">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="h-80 lg:h-[500px] rounded-2xl overflow-hidden order-2 lg:order-1"
      >
        {content.image_url ? (
          <img src={content.image_url} alt={content.headline || g.business_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl font-bold" style={{ backgroundColor: `${g.primary_color}22`, color: g.primary_color }}>
            {g.business_name.charAt(0)}
          </div>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
        className="order-1 lg:order-2"
      >
        {content.badge_text && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ backgroundColor: `${g.primary_color}15`, color: g.primary_color }}>
            {content.badge_text}
          </span>
        )}
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-6 leading-tight text-slate-900" style={{ fontFamily: g.font_heading }}>
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
        <HeroButtons content={content} primary_color={g.primary_color} />
      </motion.div>
    </div>
  </section>
);

// ─── Video Background ─────────────────────────────────────────────────────────
const HeroVideoBg: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-24 px-4 text-center relative overflow-hidden min-h-[60vh] flex items-center">
    {content.video_url ? (
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        src={content.video_url}
      />
    ) : null}
    <div className="absolute inset-0 z-0 bg-slate-900/65" />
    <div className="max-w-3xl mx-auto relative z-10 text-white">
      {content.badge_text && (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-white/10 border border-white/20">
          {content.badge_text}
        </span>
      )}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ fontFamily: g.font_heading }}>
        {content.headline}
      </h1>
      <p className="text-xl mb-10 opacity-80" style={{ fontFamily: g.font_body }}>
        {content.subheadline}
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {content.cta_primary_text && (
          <a href={content.cta_primary_link || '#contact'} className="inline-block px-8 py-4 rounded-xl text-white text-lg font-semibold shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: g.primary_color }}>
            {content.cta_primary_text}
          </a>
        )}
        {content.cta_secondary_text && (
          <a href={content.cta_secondary_link || '#contact'} className="inline-block px-8 py-4 rounded-xl text-lg font-semibold bg-white/10 border border-white/30 hover:bg-white/20 transition-colors">
            {content.cta_secondary_text}
          </a>
        )}
      </div>
    </div>
  </section>
);

// ─── Minimal (large typography, clean white) ──────────────────────────────────
const HeroMinimal: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-28 px-4 bg-white">
    <div className="max-w-4xl mx-auto">
      {content.badge_text && (
        <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ color: g.primary_color }}>
          {content.badge_text}
        </span>
      )}
      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-8 leading-none text-slate-900" style={{ fontFamily: g.font_heading }}>
        {content.headline}
      </h1>
      <div className="flex items-start gap-8">
        <div className="w-1 h-24 shrink-0 rounded-full" style={{ backgroundColor: g.primary_color }} />
        <div>
          <p className="text-xl text-slate-600 mb-8" style={{ fontFamily: g.font_body }}>
            {content.subheadline}
          </p>
          <HeroButtons content={content} primary_color={g.primary_color} />
        </div>
      </div>
    </div>
  </section>
);

// ─── Gradient (animated CSS gradient background) ──────────────────────────────
const HeroGradient: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  return (
    <section className="py-24 px-4 text-center relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${g.primary_color} 0%, ${g.secondary_color || '#6366f1'} 100%)` }}>
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .hero-gradient-anim { animation: gradient-shift 6s ease-in-out infinite; }
      `}</style>
      <div className="hero-gradient-anim absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at 20% 50%, white 0%, transparent 60%)` }} />
      <div className="max-w-3xl mx-auto relative z-10 text-white">
        {content.badge_text && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-white/15 border border-white/25">
            {content.badge_text}
          </span>
        )}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ fontFamily: g.font_heading }}>
          {content.headline}
        </h1>
        <p className="text-xl mb-10 opacity-85" style={{ fontFamily: g.font_body }}>
          {content.subheadline}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {content.cta_primary_text && (
            <a href={content.cta_primary_link || '#contact'} className="inline-block px-8 py-4 rounded-xl bg-white text-lg font-semibold shadow-xl transition-transform hover:scale-105" style={{ color: g.primary_color }}>
              {content.cta_primary_text}
            </a>
          )}
          {content.cta_secondary_text && (
            <a href={content.cta_secondary_link || '#contact'} className="inline-block px-8 py-4 rounded-xl text-lg font-semibold bg-white/15 border border-white/30 hover:bg-white/25 transition-colors text-white">
              {content.cta_secondary_text}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Parallax (CSS background-attachment parallax) ────────────────────────────
const HeroParallax: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        setOffset(rect.top * 0.4);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const bgImage = content.background_image_url || content.image_url;

  return (
    <section
      ref={sectionRef}
      className="py-24 px-4 text-center relative overflow-hidden min-h-[70vh] flex items-center"
    >
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : `linear-gradient(135deg, ${g.primary_color} 0%, ${g.primary_color}88 100%)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: `translateY(${offset}px)`,
          willChange: 'transform',
        }}
      />
      <div className="absolute inset-0 z-0 bg-slate-900/55" />
      <div className="max-w-3xl mx-auto relative z-10 text-white">
        {content.badge_text && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-white/10 border border-white/20">
            {content.badge_text}
          </span>
        )}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ fontFamily: g.font_heading }}>
          {content.headline}
        </h1>
        <p className="text-xl mb-10 opacity-80" style={{ fontFamily: g.font_body }}>
          {content.subheadline}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {content.cta_primary_text && (
            <a href={content.cta_primary_link || '#contact'} className="inline-block px-8 py-4 rounded-xl text-white text-lg font-semibold shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: g.primary_color }}>
              {content.cta_primary_text}
            </a>
          )}
          {content.cta_secondary_text && (
            <a href={content.cta_secondary_link || '#contact'} className="inline-block px-8 py-4 rounded-xl text-lg font-semibold bg-white/10 border border-white/30 hover:bg-white/20 transition-colors">
              {content.cta_secondary_text}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Legacy variants (kept for backward compat) ───────────────────────────────
const HeroSplitImageLeft: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <HeroSplitRight content={content} global={g} style_overrides={{}} />
);

const HeroBoldStatement: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-28 px-4 text-center text-white relative overflow-hidden" style={{ backgroundColor: g.primary_color }}>
    <div className="max-w-4xl mx-auto relative z-10">
      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-6 leading-none uppercase tracking-tight" style={{ fontFamily: g.font_heading }}>
        {content.headline}
      </h1>
      <p className="text-xl sm:text-2xl mb-10 opacity-90" style={{ fontFamily: g.font_body }}>
        {content.subheadline}
      </p>
      {content.cta_primary_text && (
        <a href={content.cta_primary_link || '#contact'} className="inline-block px-10 py-4 rounded-xl bg-white text-lg font-bold shadow-2xl transition-transform hover:scale-105" style={{ color: g.primary_color }}>
          {content.cta_primary_text}
        </a>
      )}
    </div>
  </section>
);

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const HeroSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'centered';
  const allProps = { content, ...props };

  if (v === 'split_image_left')  return <HeroSplitImageLeft {...allProps} />;
  if (v === 'bold_statement')    return <HeroBoldStatement {...allProps} />;
  if (v === 'split_left')        return <HeroSplitLeft {...allProps} />;
  if (v === 'split_right')       return <HeroSplitRight {...allProps} />;
  if (v === 'video_bg')          return <HeroVideoBg {...allProps} />;
  if (v === 'minimal')           return <HeroMinimal {...allProps} />;
  if (v === 'gradient')          return <HeroGradient {...allProps} />;
  if (v === 'parallax')          return <HeroParallax {...allProps} />;
  return <HeroCenteredCta {...allProps} />;
};

export default HeroSection;
