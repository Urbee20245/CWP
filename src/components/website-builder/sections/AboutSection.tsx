import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

// ─── Left text + right stats (default / "split") ─────────────────────────────
const AboutLeftTextRightStats: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-slate-50">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div>
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6" style={{ fontFamily: g.font_heading }}>
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
          <div key={i} className="p-6 rounded-2xl text-center text-white" style={{ backgroundColor: i % 2 === 0 ? g.primary_color : `${g.primary_color}cc` }}>
            <div className="text-3xl font-extrabold mb-1" style={{ fontFamily: g.font_heading }}>{stat.number}</div>
            <div className="text-sm opacity-90" style={{ fontFamily: g.font_body }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Centered story ───────────────────────────────────────────────────────────
const AboutCenteredStory: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-3xl mx-auto text-center">
      <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6" style={{ fontFamily: g.font_heading }}>
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
              <div className="text-4xl font-extrabold" style={{ color: g.primary_color, fontFamily: g.font_heading }}>{stat.number}</div>
              <div className="text-slate-500 text-sm mt-1" style={{ fontFamily: g.font_body }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
);

// ─── Founder focus ────────────────────────────────────────────────────────────
const AboutFounderFocus: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-slate-900 text-white">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
      {(content.image_url || (g as any).founder_photo_url) ? (
        <div className="h-64 lg:h-80 rounded-2xl overflow-hidden">
          <img src={content.image_url || (g as any).founder_photo_url} alt={content.heading || g.business_name} className="w-full h-full object-cover rounded-2xl shadow-xl" />
        </div>
      ) : (
        <div className="h-64 lg:h-80 rounded-2xl flex items-center justify-center text-5xl font-black" style={{ backgroundColor: g.primary_color }}>
          {g.business_name.charAt(0)}
        </div>
      )}
      <div className="lg:col-span-2">
        <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ fontFamily: g.font_heading }}>{content.heading}</h2>
        <p className="text-slate-300 text-lg leading-relaxed" style={{ fontFamily: g.font_body }}>{content.body}</p>
      </div>
    </div>
  </section>
);

// ─── Full width (large bg image + text overlay) ───────────────────────────────
const AboutFullWidth: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-32 px-4 relative overflow-hidden min-h-[60vh] flex items-center">
    {content.image_url ? (
      <>
        <div className="absolute inset-0 z-0">
          <img src={content.image_url} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 z-0 bg-slate-900/70" />
      </>
    ) : (
      <div className="absolute inset-0 z-0" style={{ backgroundColor: g.primary_color }} />
    )}
    <div className="max-w-3xl mx-auto relative z-10 text-white text-center">
      <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ fontFamily: g.font_heading }}>{content.heading}</h2>
      <p className="text-xl leading-relaxed opacity-90" style={{ fontFamily: g.font_body }}>{content.body}</p>
    </div>
  </section>
);

// ─── Timeline item with IntersectionObserver reveal ──────────────────────────
const TimelineItem: React.FC<{ item: any; index: number; color: string; fontHeading: string; fontBody: string }> = ({
  item, index, color, fontHeading, fontBody,
}) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -30 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex gap-6"
    >
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 z-10" style={{ backgroundColor: color }}>
        {item.year?.slice(-2) || index + 1}
      </div>
      <div className="pt-2">
        {item.year && <span className="text-xs font-bold tracking-wider uppercase mb-1 block" style={{ color }}>{item.year}</span>}
        <h3 className="text-xl font-bold mb-2 text-slate-900" style={{ fontFamily: fontHeading }}>{item.title}</h3>
        <p className="text-slate-600 leading-relaxed" style={{ fontFamily: fontBody }}>{item.description}</p>
      </div>
    </motion.div>
  );
};

// ─── Timeline ─────────────────────────────────────────────────────────────────
const AboutTimeline: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const milestones: any[] = content.milestones || content.timeline || [];
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-4" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        {content.body && (
          <p className="text-slate-600 text-center mb-14 text-lg" style={{ fontFamily: g.font_body }}>{content.body}</p>
        )}
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5" style={{ backgroundColor: `${g.primary_color}30` }} />
          <div className="space-y-10">
            {milestones.map((item, i) => (
              <TimelineItem key={i} item={item} index={i} color={g.primary_color} fontHeading={g.font_heading} fontBody={g.font_body} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Story (long-form narrative with sticky image) ────────────────────────────
const AboutStory: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="lg:sticky lg:top-20">
          {content.image_url
            ? <img src={content.image_url} alt={content.heading || g.business_name} className="w-full rounded-2xl object-cover shadow-xl" />
            : <div className="w-full h-80 rounded-2xl flex items-center justify-center text-6xl font-black text-white" style={{ backgroundColor: g.primary_color }}>{g.business_name.charAt(0)}</div>
          }
        </div>
        <div>
          <span className="inline-block text-xs font-bold uppercase tracking-widest mb-4" style={{ color: g.primary_color }}>Our Story</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
          {(Array.isArray(content.paragraphs) ? content.paragraphs : [content.body]).filter(Boolean).map((para: string, i: number) => (
            <p key={i} className="text-slate-600 text-lg leading-relaxed mb-5" style={{ fontFamily: g.font_body }}>{para}</p>
          ))}
          {content.cta_text && (
            <a href={content.cta_link || '#contact'} className="inline-block mt-4 px-6 py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: g.primary_color }}>
              {content.cta_text}
            </a>
          )}
        </div>
      </div>
    </div>
  </section>
);

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const AboutSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'split';
  const allProps = { content, ...props };

  if (v === 'centered_story') return <AboutCenteredStory {...allProps} />;
  if (v === 'founder_focus')  return <AboutFounderFocus {...allProps} />;
  if (v === 'full_width')     return <AboutFullWidth {...allProps} />;
  if (v === 'timeline')       return <AboutTimeline {...allProps} />;
  if (v === 'story')          return <AboutStory {...allProps} />;
  return <AboutLeftTextRightStats {...allProps} />;
};

export default AboutSection;
