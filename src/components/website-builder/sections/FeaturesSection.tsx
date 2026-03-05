import React from 'react';
import { SectionComponentProps } from '../../../types/website';

const FeaturesSection: React.FC<SectionComponentProps & { variant: string }> = ({
  content,
  global: g,
  style_overrides,
  variant,
}) => {
  const features: Array<{ title: string; description: string; icon?: string; highlight?: boolean }> =
    content.features || [];

  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  if (variant === 'alternating_blocks') {
    return (
      <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
            {content.heading}
          </h2>
          {content.subtext && (
            <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
          )}
          <div className="space-y-16">
            {features.map((feature, i) => (
              <div key={i} className={`flex flex-col md:flex-row gap-10 items-center ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                <div
                  className="w-full md:w-1/3 h-48 rounded-2xl flex items-center justify-center text-5xl shrink-0"
                  style={{ backgroundColor: feature.highlight ? g.primary_color : `${g.primary_color}15` }}
                >
                  {feature.icon || '✦'}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: g.font_heading, color: textColor }}>
                    {feature.title}
                  </h3>
                  <p className="opacity-70 leading-relaxed text-lg" style={{ fontFamily: g.font_body }}>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'checklist') {
    return (
      <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
            {content.heading}
          </h2>
          {content.subtext && (
            <p className="text-center mb-10 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: `${g.primary_color}08` }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm shrink-0 mt-0.5" style={{ backgroundColor: g.primary_color }}>
                  ✓
                </span>
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
  }

  // Default: icon_grid
  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-center mb-12 opacity-70 text-lg" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border transition-shadow hover:shadow-lg"
              style={{
                borderColor: feature.highlight ? g.primary_color : `${g.primary_color}20`,
                backgroundColor: feature.highlight ? `${g.primary_color}08` : 'transparent',
              }}
            >
              <div className="text-3xl mb-4">{feature.icon || '◆'}</div>
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: g.font_heading, color: textColor }}>
                {feature.title}
              </h3>
              <p className="opacity-70 leading-relaxed" style={{ fontFamily: g.font_body }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
