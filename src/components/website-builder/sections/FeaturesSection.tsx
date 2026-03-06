import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Icon } from '@iconify/react';
import { CheckCircle } from 'lucide-react';

type Feature = { title: string; description: string; icon?: string; icon_name?: string; image_url?: string; highlight?: boolean; size?: 'large' | 'small' };

const FeatureIcon: React.FC<{ feature: Feature; color: string; size?: number }> = ({ feature, color, size = 32 }) => {
  if (feature.icon_name) return <Icon icon={feature.icon_name} width={size} height={size} style={{ color }} />;
  if (feature.icon) return <span style={{ fontSize: size * 0.75 }}>{feature.icon}</span>;
  return <span style={{ color, fontSize: size * 0.75 }}>◆</span>;
};

// ─── Grid (default) ───────────────────────────────────────────────────────────
const FeaturesGrid: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const features: Feature[] = content.features || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-12 opacity-70 text-lg" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="p-6 rounded-2xl border transition-shadow hover:shadow-lg" style={{ borderColor: feature.highlight ? g.primary_color : `${g.primary_color}20`, backgroundColor: feature.highlight ? `${g.primary_color}08` : 'transparent' }}>
              <div className="mb-4"><FeatureIcon feature={feature} color={g.primary_color} /></div>
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: g.font_heading, color: textColor }}>{feature.title}</h3>
              <p className="opacity-70 leading-relaxed" style={{ fontFamily: g.font_body }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Alternating (framer-motion reveal each row) ──────────────────────────────
const AlternatingItem: React.FC<{ feature: Feature; index: number; color: string; fontHeading: string; fontBody: string }> = ({
  feature, index, color, fontHeading, fontBody,
}) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
  const isOdd = index % 2 === 1;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className={`flex flex-col md:flex-row gap-10 items-center ${isOdd ? 'md:flex-row-reverse' : ''}`}
    >
      <div className="w-full md:w-1/2 h-56 rounded-2xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: feature.highlight ? color : `${color}12` }}>
        {feature.image_url
          ? <img src={feature.image_url} alt={feature.title} className="w-full h-full object-cover" />
          : <FeatureIcon feature={feature} color={feature.highlight ? '#fff' : color} size={64} />
        }
      </div>
      <div className="flex-1">
        <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: fontHeading }}>{feature.title}</h3>
        <p className="opacity-70 leading-relaxed text-lg" style={{ fontFamily: fontBody }}>{feature.description}</p>
      </div>
    </motion.div>
  );
};

const FeaturesAlternating: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const features: Feature[] = content.features || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-16 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="space-y-16">
          {features.map((feature, i) => (
            <AlternatingItem key={i} feature={feature} index={i} color={g.primary_color} fontHeading={g.font_heading} fontBody={g.font_body} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Bento grid (mixed sizes) ─────────────────────────────────────────────────
const FeaturesBento: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const features: Feature[] = content.features || [];
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => {
            const isLarge = feature.size === 'large' || (i === 0 && features.length >= 4);
            return (
              <motion.div
                key={i}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`rounded-2xl p-7 ${isLarge ? 'sm:col-span-2 lg:col-span-2' : ''}`}
                style={{
                  backgroundColor: feature.highlight ? g.primary_color : '#ffffff',
                  color: feature.highlight ? '#ffffff' : textColor,
                  border: feature.highlight ? 'none' : `1px solid ${g.primary_color}15`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <div className="mb-4">
                  <FeatureIcon feature={feature} color={feature.highlight ? '#ffffff' : g.primary_color} size={36} />
                </div>
                <h3 className={`font-bold mb-2 ${isLarge ? 'text-2xl' : 'text-lg'}`} style={{ fontFamily: g.font_heading }}>
                  {feature.title}
                </h3>
                <p className={`leading-relaxed text-sm ${feature.highlight ? 'opacity-90' : 'opacity-70'}`} style={{ fontFamily: g.font_body }}>
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── Icon list (icon + text rows) ────────────────────────────────────────────
const FeaturesIconList: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const features: Feature[] = content.features || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-10 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl" style={{ backgroundColor: `${g.primary_color}06` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${g.primary_color}15` }}>
                {feature.icon_name || feature.icon
                  ? <FeatureIcon feature={feature} color={g.primary_color} size={20} />
                  : <CheckCircle className="w-5 h-5" style={{ color: g.primary_color }} />
                }
              </div>
              <div>
                <h4 className="font-semibold mb-1" style={{ fontFamily: g.font_heading, color: textColor }}>{feature.title}</h4>
                <p className="text-sm opacity-70" style={{ fontFamily: g.font_body }}>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Legacy: alternating_blocks ───────────────────────────────────────────────
const FeaturesAlternatingBlocks: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const features: Feature[] = content.features || [];
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
        <div className="space-y-16">
          {features.map((feature, i) => (
            <div key={i} className={`flex flex-col md:flex-row gap-10 items-center ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
              <div className="w-full md:w-1/3 h-48 rounded-2xl flex items-center justify-center text-5xl shrink-0" style={{ backgroundColor: feature.highlight ? g.primary_color : `${g.primary_color}15` }}>
                <FeatureIcon feature={feature} color={feature.highlight ? '#fff' : g.primary_color} size={48} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: g.font_heading, color: textColor }}>{feature.title}</h3>
                <p className="opacity-70 leading-relaxed text-lg" style={{ fontFamily: g.font_body }}>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Legacy: checklist ────────────────────────────────────────────────────────
const FeaturesChecklist: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const features: Feature[] = content.features || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-10 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: `${g.primary_color}08` }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm shrink-0 mt-0.5" style={{ backgroundColor: g.primary_color }}>✓</span>
              <div>
                <h4 className="font-semibold mb-1" style={{ fontFamily: g.font_heading, color: textColor }}>{feature.title}</h4>
                <p className="text-sm opacity-70" style={{ fontFamily: g.font_body }}>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const FeaturesSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'grid';
  const allProps = { content, ...props };

  if (v === 'alternating_blocks') return <FeaturesAlternatingBlocks {...allProps} />;
  if (v === 'checklist')          return <FeaturesChecklist {...allProps} />;
  if (v === 'alternating')        return <FeaturesAlternating {...allProps} />;
  if (v === 'bento')              return <FeaturesBento {...allProps} />;
  if (v === 'icon_list')          return <FeaturesIconList {...allProps} />;
  return <FeaturesGrid {...allProps} />;
};

export default FeaturesSection;
