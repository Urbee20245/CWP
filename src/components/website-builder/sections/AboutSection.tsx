import React from 'react';
import { SectionComponentProps } from '../../../types/website';

const AboutLeftTextRightStats: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-slate-50">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div>
        <h2
          className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
        <p className="text-slate-600 text-lg leading-relaxed" style={{ fontFamily: g.font_body }}>
          {content.body}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[
          { number: content.stat_1_number, label: content.stat_1_label },
          { number: content.stat_2_number, label: content.stat_2_label },
          { number: content.stat_3_number, label: content.stat_3_label },
          { number: content.stat_4_number, label: content.stat_4_label },
        ].filter(s => s.number).map((stat, i) => (
          <div
            key={i}
            className="p-6 rounded-2xl text-center text-white"
            style={{ backgroundColor: i % 2 === 0 ? g.primary_color : `${g.primary_color}cc` }}
          >
            <div className="text-3xl font-extrabold mb-1" style={{ fontFamily: g.font_heading }}>
              {stat.number}
            </div>
            <div className="text-sm opacity-90" style={{ fontFamily: g.font_body }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const AboutCenteredStory: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-3xl mx-auto text-center">
      <h2
        className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      <p className="text-slate-600 text-xl leading-relaxed" style={{ fontFamily: g.font_body }}>
        {content.body}
      </p>
      {(content.stat_1_number || content.stat_2_number) && (
        <div className="flex justify-center gap-12 mt-10">
          {[
            { number: content.stat_1_number, label: content.stat_1_label },
            { number: content.stat_2_number, label: content.stat_2_label },
          ].filter(s => s.number).map((stat, i) => (
            <div key={i}>
              <div
                className="text-4xl font-extrabold"
                style={{ color: g.primary_color, fontFamily: g.font_heading }}
              >
                {stat.number}
              </div>
              <div className="text-slate-500 text-sm mt-1" style={{ fontFamily: g.font_body }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
);

const AboutFounderFocus: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-slate-900 text-white">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
      {(content.image_url || g.founder_photo_url) ? (
        <div className="h-64 lg:h-80 rounded-2xl overflow-hidden">
          <img
            src={content.image_url || g.founder_photo_url}
            alt={content.heading || g.business_name}
            className="w-full h-full object-cover rounded-2xl shadow-xl"
          />
        </div>
      ) : (
        <div
          className="h-64 lg:h-80 rounded-2xl flex items-center justify-center text-5xl font-black"
          style={{ backgroundColor: g.primary_color }}
        >
          {g.business_name.charAt(0)}
        </div>
      )}
      <div className="lg:col-span-2">
        <h2
          className="text-3xl sm:text-4xl font-bold mb-6"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
        <p className="text-slate-300 text-lg leading-relaxed" style={{ fontFamily: g.font_body }}>
          {content.body}
        </p>
      </div>
    </div>
  </section>
);

const AboutSection: React.FC<SectionComponentProps & { variant: string }> = ({ variant, ...props }) => {
  if (variant === 'centered_story') return <AboutCenteredStory {...props} />;
  if (variant === 'founder_focus') return <AboutFounderFocus {...props} />;
  return <AboutLeftTextRightStats {...props} />;
};

export default AboutSection;
