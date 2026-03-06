import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Icon } from '@iconify/react';

type TimelineItem = { year?: string; title: string; description: string; icon_name?: string };

const TimelineItemComponent: React.FC<{ item: TimelineItem; index: number; color: string; fontHeading: string; fontBody: string }> = ({
  item, index, color, fontHeading, fontBody,
}) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
  const isLeft = index % 2 === 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      className="flex gap-6 relative"
    >
      {/* Dot on line */}
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 z-10" style={{ backgroundColor: color }}>
        {item.icon_name
          ? <Icon icon={item.icon_name} width={20} height={20} />
          : (item.year?.slice(-2) || String(index + 1))
        }
      </div>
      <div className="pb-10">
        {item.year && (
          <span className="text-xs font-bold tracking-wider uppercase mb-1 block" style={{ color }}>{item.year}</span>
        )}
        <h3 className="text-xl font-bold mb-2 text-slate-900" style={{ fontFamily: fontHeading }}>{item.title}</h3>
        <p className="text-slate-600 leading-relaxed" style={{ fontFamily: fontBody }}>{item.description}</p>
      </div>
    </motion.div>
  );
};

const TimelineSection: React.FC<SectionComponentProps & { variant?: string }> = ({ content, global: g }) => {
  const items: TimelineItem[] = content.items || content.milestones || [];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-3xl mx-auto">
        {content.heading && (
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-4" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
        )}
        {content.subtext && (
          <p className="text-slate-600 text-center mb-14 text-lg" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5" style={{ backgroundColor: `${g.primary_color}30` }} />
          {items.map((item, i) => (
            <TimelineItemComponent
              key={i}
              item={item}
              index={i}
              color={g.primary_color}
              fontHeading={g.font_heading}
              fontBody={g.font_body}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TimelineSection;
