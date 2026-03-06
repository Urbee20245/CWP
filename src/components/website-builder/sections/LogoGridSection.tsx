import React from 'react';
import { SectionComponentProps } from '../../../types/website';

type Logo = { name: string; image_url?: string; url?: string };

// ─── Grid (default) ───────────────────────────────────────────────────────────
const LogoGrid: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const logos: Logo[] = content.logos || [];

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {content.heading && (
          <h2 className="text-center text-slate-500 text-sm font-semibold uppercase tracking-widest mb-8" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
        )}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {logos.map((logo, i) => {
            const inner = logo.image_url
              ? <img src={logo.image_url} alt={logo.name} className="max-h-10 max-w-32 object-contain grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100" />
              : <span className="font-bold text-slate-400 text-lg hover:text-slate-600 transition-colors">{logo.name}</span>;

            return logo.url
              ? <a key={i} href={logo.url} target="_blank" rel="noopener noreferrer">{inner}</a>
              : <div key={i}>{inner}</div>;
          })}
          {logos.length === 0 && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-28 h-10 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Marquee (infinite scroll) ────────────────────────────────────────────────
const LogoMarquee: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const logos: Logo[] = content.logos || [];
  const doubled = [...logos, ...logos];

  return (
    <section className="py-14 bg-white overflow-hidden">
      {content.heading && (
        <h2 className="text-center text-slate-500 text-sm font-semibold uppercase tracking-widest mb-8 px-4" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
      )}
      <style>{`
        @keyframes logo-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .logo-marquee-track { animation: logo-marquee 20s linear infinite; }
        .logo-marquee-wrap:hover .logo-marquee-track { animation-play-state: paused; }
      `}</style>
      <div className="logo-marquee-wrap">
        <div className="logo-marquee-track flex items-center gap-12 w-max px-6">
          {doubled.map((logo, i) => (
            logo.image_url
              ? <img key={i} src={logo.image_url} alt={logo.name} className="max-h-10 max-w-32 object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all shrink-0" />
              : <span key={i} className="font-bold text-slate-400 text-lg shrink-0">{logo.name}</span>
          ))}
          {logos.length === 0 && Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-28 h-10 bg-slate-100 rounded-lg shrink-0" />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const LogoGridSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'grid';
  const allProps = { content, ...props };

  if (v === 'marquee') return <LogoMarquee {...allProps} />;
  return <LogoGrid {...allProps} />;
};

export default LogoGridSection;
