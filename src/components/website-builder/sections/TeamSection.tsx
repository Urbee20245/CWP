import React, { useCallback, useEffect, useState } from 'react';
import { SectionComponentProps } from '../../../types/website';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Member = { name: string; role: string; bio?: string; image_url?: string; linkedin_url?: string };

const Avatar: React.FC<{ member: Member; color: string; size?: 'sm' | 'lg' }> = ({ member, color, size = 'lg' }) => {
  const dim = size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-16 h-16 text-lg';
  if (member.image_url) {
    return <img src={member.image_url} alt={member.name} className={`${dim} rounded-full object-cover`} />;
  }
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`${dim} rounded-full flex items-center justify-center text-white font-bold`} style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
};

// ─── Card Grid (default) ───────────────────────────────────────────────────────
const TeamCardGrid: React.FC<SectionComponentProps & { style_overrides?: any }> = ({ content, global: g, style_overrides }) => {
  const members: Member[] = content.members || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {members.map((member, i) => (
            <div key={i} className="text-center p-6 rounded-2xl border" style={{ borderColor: `${g.primary_color}20` }}>
              <div className="flex justify-center mb-4"><Avatar member={member} color={g.primary_color} /></div>
              <h3 className="text-xl font-bold mb-1" style={{ fontFamily: g.font_heading, color: textColor }}>{member.name}</h3>
              <p className="text-sm font-medium mb-3" style={{ color: g.primary_color }}>{member.role}</p>
              {member.bio && <p className="text-sm opacity-70 leading-relaxed" style={{ fontFamily: g.font_body }}>{member.bio}</p>}
              {member.linkedin_url && (
                <a href={member.linkedin_url} className="inline-block mt-3 text-xs font-medium opacity-60 hover:opacity-100" style={{ color: g.primary_color }}>LinkedIn →</a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Cards with hover bio overlay ─────────────────────────────────────────────
const TeamHoverCards: React.FC<SectionComponentProps & { style_overrides?: any }> = ({ content, global: g, style_overrides }) => {
  const members: Member[] = content.members || [];
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {members.map((member, i) => (
            <motion.div
              key={i}
              className="relative overflow-hidden rounded-2xl cursor-default"
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="h-64">
                {member.image_url
                  ? <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white" style={{ backgroundColor: g.primary_color }}>
                      {member.name.charAt(0)}
                    </div>
                }
              </div>
              <div className="p-4 bg-white">
                <h3 className="font-bold text-slate-900" style={{ fontFamily: g.font_heading }}>{member.name}</h3>
                <p className="text-sm" style={{ color: g.primary_color }}>{member.role}</p>
              </div>
              {member.bio && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col justify-end p-5 text-white"
                  style={{ background: `linear-gradient(to top, ${g.primary_color}ee 0%, transparent 55%)` }}
                >
                  <p className="text-sm leading-relaxed">{member.bio}</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Carousel ─────────────────────────────────────────────────────────────────
const TeamCarousel: React.FC<SectionComponentProps & { style_overrides?: any }> = ({ content, global: g, style_overrides }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const members: Member[] = content.members || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', () => setSelectedIndex(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {members.map((member, i) => (
                <div key={i} className="flex-none w-72 text-center p-6 rounded-2xl border" style={{ borderColor: `${g.primary_color}20` }}>
                  <div className="flex justify-center mb-4"><Avatar member={member} color={g.primary_color} /></div>
                  <h3 className="text-lg font-bold mb-1" style={{ fontFamily: g.font_heading, color: textColor }}>{member.name}</h3>
                  <p className="text-sm font-medium mb-3" style={{ color: g.primary_color }}>{member.role}</p>
                  {member.bio && <p className="text-sm opacity-70 leading-relaxed" style={{ fontFamily: g.font_body }}>{member.bio}</p>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={scrollPrev} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <button onClick={scrollNext} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
        </div>
        <div className="flex justify-center gap-2 mt-6">
          {members.map((_, i) => (
            <button key={i} onClick={() => emblaApi?.scrollTo(i)} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: i === selectedIndex ? g.primary_color : `${g.primary_color}40` }} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Founder Spotlight (legacy) ────────────────────────────────────────────────
const TeamFounderSpotlight: React.FC<SectionComponentProps & { style_overrides?: any }> = ({ content, global: g, style_overrides }) => {
  const members: Member[] = content.members || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';
  if (members.length === 0) return null;
  const founder = members[0];
  const rest = members.slice(1);

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-12 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>{content.heading}</h2>
        <div className="flex flex-col md:flex-row gap-10 items-center mb-16">
          <Avatar member={founder} color={g.primary_color} size="lg" />
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-1" style={{ fontFamily: g.font_heading, color: textColor }}>{founder.name}</h3>
            <p className="font-medium mb-4" style={{ color: g.primary_color }}>{founder.role}</p>
            {founder.bio && <p className="opacity-70 leading-relaxed text-lg" style={{ fontFamily: g.font_body }}>{founder.bio}</p>}
          </div>
        </div>
        {rest.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {rest.map((member, i) => (
              <div key={i} className="text-center">
                <div className="flex justify-center mb-3"><Avatar member={member} color={g.primary_color} size="sm" /></div>
                <h4 className="font-bold" style={{ fontFamily: g.font_heading, color: textColor }}>{member.name}</h4>
                <p className="text-sm opacity-60" style={{ fontFamily: g.font_body }}>{member.role}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ─── Minimal List (legacy) ─────────────────────────────────────────────────────
const TeamMinimalList: React.FC<SectionComponentProps & { style_overrides?: any }> = ({ content, global: g, style_overrides }) => {
  const members: Member[] = content.members || [];
  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>{content.heading}</h2>
        {content.subtext && <p className="text-center mb-10 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        <div className="divide-y" style={{ borderColor: `${g.primary_color}20` }}>
          {members.map((member, i) => (
            <div key={i} className="flex items-center gap-4 py-5">
              <Avatar member={member} color={g.primary_color} size="sm" />
              <div>
                <h3 className="font-bold" style={{ fontFamily: g.font_heading, color: textColor }}>{member.name}</h3>
                <p className="text-sm" style={{ color: g.primary_color }}>{member.role}</p>
              </div>
              {member.bio && <p className="hidden md:block flex-1 text-sm opacity-60 text-right" style={{ fontFamily: g.font_body }}>{member.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const TeamSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'card_grid';
  const allProps = { content, ...props };

  if (v === 'founder_spotlight') return <TeamFounderSpotlight {...allProps} />;
  if (v === 'minimal_list')      return <TeamMinimalList {...allProps} />;
  if (v === 'cards')             return <TeamHoverCards {...allProps} />;
  if (v === 'carousel')          return <TeamCarousel {...allProps} />;
  return <TeamCardGrid {...allProps} />;
};

export default TeamSection;
