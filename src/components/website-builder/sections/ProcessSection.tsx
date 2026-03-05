import React from 'react';
import { SectionComponentProps } from '../../../types/website';

const ProcessSection: React.FC<SectionComponentProps & { variant: string }> = ({
  content,
  global: g,
  style_overrides,
  variant,
}) => {
  const steps: Array<{ number: string; title: string; description: string; icon?: string }> =
    content.steps || [];

  const bg = style_overrides?.background || '#f8fafc';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  if (variant === 'timeline') {
    return (
      <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
            {content.heading}
          </h2>
          {content.subtext && (
            <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
          )}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5" style={{ backgroundColor: `${g.primary_color}40` }} />
            <div className="space-y-8">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-6 relative">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 z-10"
                    style={{ backgroundColor: g.primary_color }}
                  >
                    {step.number || i + 1}
                  </div>
                  <div className="pt-2">
                    <h3 className="text-xl font-bold mb-2" style={{ fontFamily: g.font_heading, color: textColor }}>
                      {step.title}
                    </h3>
                    <p className="opacity-70" style={{ fontFamily: g.font_body }}>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'horizontal_flow') {
    return (
      <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
            {content.heading}
          </h2>
          {content.subtext && (
            <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-0.5 z-0" style={{ backgroundColor: `${g.primary_color}30` }} />
                )}
                <div className="text-center relative z-10">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4"
                    style={{ backgroundColor: g.primary_color }}
                  >
                    {step.number || i + 1}
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ fontFamily: g.font_heading, color: textColor }}>
                    {step.title}
                  </h3>
                  <p className="text-sm opacity-70" style={{ fontFamily: g.font_body }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default: numbered_steps / icon_cards
  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4"
                style={{ backgroundColor: g.primary_color }}
              >
                {step.icon || step.number || i + 1}
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: g.font_heading, color: textColor }}>
                {step.title}
              </h3>
              <p className="opacity-70 leading-relaxed" style={{ fontFamily: g.font_body }}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProcessSection;
