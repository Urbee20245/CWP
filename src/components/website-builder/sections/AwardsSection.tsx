import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { Award } from 'lucide-react';

type AwardItem = { title: string; issuer?: string; year?: string; image_url?: string };

// ─── Grid ─────────────────────────────────────────────────────────────────────
const AwardsGrid: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const items: AwardItem[] = content.items || [];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {content.heading && (
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl border border-slate-100 shadow-sm">
              {item.image_url
                ? <img src={item.image_url} alt={item.title} className="w-20 h-20 object-contain mb-4" />
                : <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${g.primary_color}15` }}>
                    <Award className="w-8 h-8" style={{ color: g.primary_color }} />
                  </div>
              }
              <h3 className="font-bold text-slate-900 mb-1" style={{ fontFamily: g.font_heading }}>{item.title}</h3>
              {item.issuer && <p className="text-sm text-slate-500">{item.issuer}</p>}
              {item.year && <p className="text-xs font-semibold mt-1" style={{ color: g.primary_color }}>{item.year}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── List ─────────────────────────────────────────────────────────────────────
const AwardsList: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const items: AwardItem[] = content.items || [];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        {content.heading && (
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
        )}
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-5 rounded-xl border border-slate-100 shadow-sm">
              {item.image_url
                ? <img src={item.image_url} alt={item.title} className="w-14 h-14 object-contain shrink-0" />
                : <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${g.primary_color}15` }}>
                    <Award className="w-6 h-6" style={{ color: g.primary_color }} />
                  </div>
              }
              <div>
                <h3 className="font-bold text-slate-900" style={{ fontFamily: g.font_heading }}>{item.title}</h3>
                {item.issuer && <p className="text-sm text-slate-500">{item.issuer}</p>}
              </div>
              {item.year && <span className="ml-auto text-sm font-semibold shrink-0" style={{ color: g.primary_color }}>{item.year}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Badges ───────────────────────────────────────────────────────────────────
const AwardsBadges: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const items: AwardItem[] = content.items || [];

  return (
    <section className="py-16 px-4 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        {content.heading && (
          <h2 className="text-center text-slate-500 text-sm font-semibold uppercase tracking-widest mb-8" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
        )}
        <div className="flex flex-wrap justify-center gap-6">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white shadow-sm text-sm font-medium text-slate-700">
              {item.image_url
                ? <img src={item.image_url} alt={item.title} className="w-6 h-6 object-contain" />
                : <Award className="w-4 h-4" style={{ color: g.primary_color }} />
              }
              <span>{item.title}</span>
              {item.year && <span className="text-xs opacity-60">{item.year}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const AwardsSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'grid';
  const allProps = { content, ...props };

  if (v === 'list')   return <AwardsList {...allProps} />;
  if (v === 'badges') return <AwardsBadges {...allProps} />;
  return <AwardsGrid {...allProps} />;
};

export default AwardsSection;
