import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import CountUp from 'react-countup';
import { useInView } from 'react-intersection-observer';

// ─── Animated stat item ────────────────────────────────────────────────────────
const AnimatedStat: React.FC<{
  stat: { number: string; label: string };
  color: string;
  fontHeading: string;
  fontBody: string;
  large?: boolean;
}> = ({ stat, color, fontHeading, fontBody, large = false }) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  const raw = String(stat.number || '');
  const numeric = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
  const prefix = raw.match(/^[^0-9]*/)?.[0] || '';
  const suffix = raw.match(/[^0-9.]+$/)?.[0] || '';
  const decimals = raw.includes('.') ? (raw.split('.')[1]?.replace(/[^0-9]/g, '').length || 0) : 0;

  return (
    <div ref={ref} className="text-center">
      <div
        className={`font-extrabold mb-2 ${large ? 'text-6xl sm:text-7xl lg:text-8xl' : 'text-4xl sm:text-5xl'}`}
        style={{ color, fontFamily: fontHeading }}
      >
        {prefix}
        {inView ? (
          <CountUp start={0} end={numeric} duration={2.2} decimals={decimals} separator="," useEasing />
        ) : '0'}
        {suffix}
      </div>
      <div className={`text-slate-600 font-medium ${large ? 'text-lg' : 'text-sm'}`} style={{ fontFamily: fontBody }}>
        {stat.label}
      </div>
    </div>
  );
};

// ─── Row (default) ────────────────────────────────────────────────────────────
const StatsRow: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-16 px-4" style={{ backgroundColor: `${g.primary_color}10` }}>
    <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
      {(content.stats || []).map((stat: any, i: number) => (
        <AnimatedStat key={i} stat={stat} color={g.primary_color} fontHeading={g.font_heading} fontBody={g.font_body} />
      ))}
    </div>
  </section>
);

// ─── Grid variant ─────────────────────────────────────────────────────────────
const StatsGrid: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-6xl mx-auto">
      {content.heading && (
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {(content.stats || []).map((stat: any, i: number) => (
          <div key={i} className="p-8 rounded-2xl text-center border" style={{ borderColor: `${g.primary_color}20` }}>
            <AnimatedStat stat={stat} color={g.primary_color} fontHeading={g.font_heading} fontBody={g.font_body} />
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Large (massive centered numbers) ────────────────────────────────────────
const StatsLarge: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-24 px-4" style={{ backgroundColor: g.primary_color }}>
    <div className="max-w-6xl mx-auto">
      {content.heading && (
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-16" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
      )}
      <div className="flex flex-wrap justify-center gap-12 lg:gap-20">
        {(content.stats || []).map((stat: any, i: number) => (
          <AnimatedStat key={i} stat={stat} color="#ffffff" fontHeading={g.font_heading} fontBody={g.font_body} large />
        ))}
      </div>
    </div>
  </section>
);

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const StatsSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'row';
  const allProps = { content, ...props };

  if (v === 'grid')  return <StatsGrid {...allProps} />;
  if (v === 'large') return <StatsLarge {...allProps} />;
  return <StatsRow {...allProps} />;
};

export default StatsSection;
