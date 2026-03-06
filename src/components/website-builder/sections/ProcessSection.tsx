import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Icon } from '@iconify/react';

type Step = { number?: string; title: string; description: string; icon?: string; icon_name?: string };

// ─── Numbered step with InView reveal ────────────────────────────────────────
const NumberedStep: React.FC<{ step: Step; index: number; color: string; fontHeading: string; fontBody: string }> = ({
  step, index, color, fontHeading, fontBody,
}) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
  const num = step.number || String(index + 1);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.12 }}
      className="text-center"
    >
      <div className="text-7xl font-black mb-4 leading-none opacity-10 select-none" style={{ color }}>{num}</div>
      <div className="text-xl font-bold mb-3 -mt-6" style={{ fontFamily: fontHeading }}>{step.title}</div>
      <p className="opacity-70 leading-relaxed" style={{ fontFamily: fontBody }}>{step.description}</p>
    </motion.div>
  );
};

// ─── Default (icon_cards / numbered_steps) ───────────────────────────────────
const ProcessDefault: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const steps: Step[] = content.steps || [];
  const bg = style_overrides?.background || '#f8fafc';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4" style={{ backgroundColor: g.primary_color }}>
                {step.icon_name ? <Icon icon={step.icon_name} width={32} height={32} /> : (step.icon || step.number || i + 1)}
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: g.font_heading, color: textColor }}>{step.title}</h3>
              <p className="opacity-70 leading-relaxed" style={{ fontFamily: g.font_body }}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Timeline ─────────────────────────────────────────────────────────────────
const ProcessTimeline: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const steps: Step[] = content.steps || [];
  const bg = style_overrides?.background || '#f8fafc';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5" style={{ backgroundColor: `${g.primary_color}40` }} />
          <div className="space-y-8">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-6 relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 z-10" style={{ backgroundColor: g.primary_color }}>
                  {step.icon_name ? <Icon icon={step.icon_name} width={20} height={20} /> : (step.number || i + 1)}
                </div>
                <div className="pt-2">
                  <h3 className="text-xl font-bold mb-2" style={{ fontFamily: g.font_heading, color: textColor }}>{step.title}</h3>
                  <p className="opacity-70" style={{ fontFamily: g.font_body }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Horizontal flow ─────────────────────────────────────────────────────────
const ProcessHorizontalFlow: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const steps: Step[] = content.steps || [];
  const bg = style_overrides?.background || '#f8fafc';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-0.5 z-0" style={{ backgroundColor: `${g.primary_color}30` }} />
              )}
              <div className="text-center relative z-10">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4" style={{ backgroundColor: g.primary_color }}>
                  {step.icon_name ? <Icon icon={step.icon_name} width={20} height={20} /> : (step.number || i + 1)}
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: g.font_heading, color: textColor }}>{step.title}</h3>
                <p className="text-sm opacity-70" style={{ fontFamily: g.font_body }}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Numbered (large numbers with reveal) ────────────────────────────────────
const ProcessNumbered: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const steps: Step[] = content.steps || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <NumberedStep key={i} step={step} index={i} color={g.primary_color} fontHeading={g.font_heading} fontBody={g.font_body} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Cards (hover effects) ────────────────────────────────────────────────────
const ProcessCards: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const steps: Step[] = content.steps || [];
  const bg = style_overrides?.background || '#f8fafc';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -6, boxShadow: '0 16px 32px rgba(0,0,0,0.1)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm text-center"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl mx-auto mb-4" style={{ backgroundColor: g.primary_color }}>
                {step.icon_name ? <Icon icon={step.icon_name} width={28} height={28} /> : (step.number || i + 1)}
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: g.font_heading, color: textColor }}>{step.title}</h3>
              <p className="text-sm opacity-70 leading-relaxed" style={{ fontFamily: g.font_body }}>{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const ProcessSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'steps';
  const allProps = { content, ...props };

  if (v === 'timeline' || v === 'timeline_vertical') return <ProcessTimeline {...allProps} />;
  if (v === 'horizontal_flow' || v === 'timeline_horizontal') return <ProcessHorizontalFlow {...allProps} />;
  if (v === 'numbered')                              return <ProcessNumbered {...allProps} />;
  if (v === 'cards')                                 return <ProcessCards {...allProps} />;
  return <ProcessDefault {...allProps} />;
};

export default ProcessSection;
