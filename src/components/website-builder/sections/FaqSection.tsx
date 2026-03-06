import React, { useState } from 'react';
import { SectionComponentProps } from '../../../types/website';
import { ChevronDown, Plus, Minus } from 'lucide-react';

// ─── Accordion (default) ───────────────────────────────────────────────────────
const FaqAccordion: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-10" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        <div className="space-y-3">
          {(content.faqs || []).map((faq: any, i: number) => (
            <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                style={{ fontFamily: g.font_heading }}
              >
                <span>{faq.question}</span>
                <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ml-4 ${open === i ? 'rotate-180' : ''}`} style={{ color: g.primary_color }} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-slate-600 leading-relaxed" style={{ fontFamily: g.font_body }}>
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Two Column ────────────────────────────────────────────────────────────────
const FaqTwoColumn: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-slate-50">
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-12" style={{ fontFamily: g.font_heading }}>
        {content.heading}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {(content.faqs || []).map((faq: any, i: number) => (
          <div key={i} className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-2" style={{ color: g.primary_color, fontFamily: g.font_heading }}>
              {faq.question}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed" style={{ fontFamily: g.font_body }}>
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Minimal (clean +/- icons, no borders) ─────────────────────────────────────
const FaqMinimal: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        <div className="divide-y divide-slate-100">
          {(content.faqs || []).map((faq: any, i: number) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left"
              >
                <span className="font-semibold text-slate-800 pr-4 text-lg" style={{ fontFamily: g.font_heading }}>
                  {faq.question}
                </span>
                {open === i
                  ? <Minus className="w-5 h-5 shrink-0" style={{ color: g.primary_color }} />
                  : <Plus className="w-5 h-5 shrink-0" style={{ color: g.primary_color }} />
                }
              </button>
              {open === i && (
                <div className="pb-5 text-slate-600 leading-relaxed text-lg" style={{ fontFamily: g.font_body }}>
                  {faq.answer}
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
const FaqSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'accordion';
  const allProps = { content, ...props };

  if (v === 'two_column' || v === 'two_col') return <FaqTwoColumn {...allProps} />;
  if (v === 'minimal')                       return <FaqMinimal {...allProps} />;
  return <FaqAccordion {...allProps} />;
};

export default FaqSection;
