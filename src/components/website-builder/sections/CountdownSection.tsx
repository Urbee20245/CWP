import React, { useEffect, useState } from 'react';
import { SectionComponentProps } from '../../../types/website';

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function calcTimeLeft(targetDate: string): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

const CountdownSection: React.FC<SectionComponentProps & { variant?: string }> = ({ content, global: g, style_overrides }) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(content.target_date || ''));

  useEffect(() => {
    if (!content.target_date) return;
    const id = setInterval(() => setTimeLeft(calcTimeLeft(content.target_date)), 1000);
    return () => clearInterval(id);
  }, [content.target_date]);

  const bg = style_overrides?.background || g.primary_color;
  const padding = style_overrides?.padding || 'py-20';

  const units: Array<{ label: string; value: number }> = [
    { label: 'Days',    value: timeLeft.days },
    { label: 'Hours',   value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <section className={`${padding} px-4 text-white text-center`} style={{ backgroundColor: bg }}>
      {content.heading && (
        <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
      )}
      {content.subtitle && (
        <p className="text-lg opacity-80 mb-10" style={{ fontFamily: g.font_body }}>{content.subtitle}</p>
      )}
      <div className="flex justify-center gap-6 sm:gap-10">
        {units.map(({ label, value }) => (
          <div key={label} className="text-center">
            <div
              className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl font-black bg-white/15 mb-2"
              style={{ fontFamily: g.font_heading }}
            >
              {String(value).padStart(2, '0')}
            </div>
            <p className="text-sm uppercase tracking-wider opacity-70">{label}</p>
          </div>
        ))}
      </div>
      {!content.target_date && (
        <p className="mt-6 opacity-60 text-sm">Set target_date in content to activate countdown</p>
      )}
    </section>
  );
};

export default CountdownSection;
