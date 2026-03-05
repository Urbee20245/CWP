import React from 'react';
import { SectionComponentProps } from '../../../types/website';

const TeamSection: React.FC<SectionComponentProps & { variant: string }> = ({
  content,
  global: g,
  style_overrides,
  variant,
}) => {
  const members: Array<{ name: string; role: string; bio?: string; image_url?: string; linkedin_url?: string }> =
    content.members || [];

  const bg = style_overrides?.background || '#ffffff';
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  const Avatar: React.FC<{ member: typeof members[0]; size?: 'sm' | 'lg' }> = ({ member, size = 'lg' }) => {
    const dim = size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-16 h-16 text-lg';
    if (member.image_url) {
      return (
        <img
          src={member.image_url}
          alt={member.name}
          className={`${dim} rounded-full object-cover`}
        />
      );
    }
    const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div
        className={`${dim} rounded-full flex items-center justify-center text-white font-bold`}
        style={{ backgroundColor: g.primary_color }}
      >
        {initials}
      </div>
    );
  };

  if (variant === 'founder_spotlight' && members.length > 0) {
    const founder = members[0];
    const rest = members.slice(1);
    return (
      <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-12 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
            {content.heading}
          </h2>
          <div className="flex flex-col md:flex-row gap-10 items-center mb-16">
            <Avatar member={founder} size="lg" />
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
                  <div className="flex justify-center mb-3"><Avatar member={member} size="sm" /></div>
                  <h4 className="font-bold" style={{ fontFamily: g.font_heading, color: textColor }}>{member.name}</h4>
                  <p className="text-sm opacity-60" style={{ fontFamily: g.font_body }}>{member.role}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (variant === 'minimal_list') {
    return (
      <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
            {content.heading}
          </h2>
          {content.subtext && (
            <p className="text-center mb-10 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
          )}
          <div className="divide-y" style={{ borderColor: `${g.primary_color}20` }}>
            {members.map((member, i) => (
              <div key={i} className="flex items-center gap-4 py-5">
                <Avatar member={member} size="sm" />
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
  }

  // Default: card_grid
  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-center mb-12 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {members.map((member, i) => (
            <div key={i} className="text-center p-6 rounded-2xl border" style={{ borderColor: `${g.primary_color}20` }}>
              <div className="flex justify-center mb-4"><Avatar member={member} /></div>
              <h3 className="text-xl font-bold mb-1" style={{ fontFamily: g.font_heading, color: textColor }}>{member.name}</h3>
              <p className="text-sm font-medium mb-3" style={{ color: g.primary_color }}>{member.role}</p>
              {member.bio && <p className="text-sm opacity-70 leading-relaxed" style={{ fontFamily: g.font_body }}>{member.bio}</p>}
              {member.linkedin_url && (
                <a href={member.linkedin_url} className="inline-block mt-3 text-xs font-medium opacity-60 hover:opacity-100" style={{ color: g.primary_color }}>
                  LinkedIn →
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeamSection;
