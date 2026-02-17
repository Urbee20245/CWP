import React from 'react';
import { SectionComponentProps } from '../../../types/website';

const StatsSection: React.FC<SectionComponentProps & { variant: string }> = ({ content, global: g }) => (
  <section className="py-16 px-4" style={{ backgroundColor: `${g.primary_color}10` }}>
    <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
      {(content.stats || []).map((stat: any, i: number) => (
        <div key={i} className="text-center">
          <div
            className="text-4xl sm:text-5xl font-extrabold mb-2"
            style={{ color: g.primary_color, fontFamily: g.font_heading }}
          >
            {stat.number}
          </div>
          <div className="text-slate-600 text-sm font-medium" style={{ fontFamily: g.font_body }}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default StatsSection;
