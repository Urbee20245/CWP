import React, { useState, useEffect, useRef } from 'react';
import { SectionComponentProps } from '../../../types/website';

// ─── Confetti burst ────────────────────────────────────────────────────────────
const fireConfetti = () => {
  try {
    const confetti = (window as any).confetti;
    if (confetti) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } else {
      import('canvas-confetti').then(m => {
        m.default({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      });
    }
  } catch { /* ignore */ }
};

// ─── Centered (default) ───────────────────────────────────────────────────────
const NewsletterCentered: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const bg = style_overrides?.background || `linear-gradient(135deg, ${g.primary_color}10 0%, ${g.primary_color}05 100%)`;
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) { setSubmitted(true); fireConfetti(); }
  };

  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading || 'Stay Updated'}
        </h2>
        {content.subtext && <p className="mb-6 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        {submitted ? (
          <p className="font-semibold text-lg" style={{ color: g.primary_color }}>Thanks! You're on the list. 🎉</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={content.placeholder_text || 'Your email address'} className="flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2" style={{ borderColor: `${g.primary_color}40`, outlineColor: g.primary_color }} required />
            <button type="submit" className="px-6 py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: g.primary_color }}>
              {content.button_text || 'Subscribe'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

// ─── Banner (full-width dark) ─────────────────────────────────────────────────
const NewsletterBanner: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const padding = style_overrides?.padding || 'py-16';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) { setSubmitted(true); fireConfetti(); }
  };

  return (
    <section className={`${padding} px-4`} style={{ background: g.primary_color, color: '#ffffff' }}>
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-2" style={{ fontFamily: g.font_heading }}>
            {content.heading || 'Stay in the Loop'}
          </h2>
          {content.subtext && <p className="opacity-80 text-lg" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        </div>
        {submitted ? (
          <p className="text-xl font-semibold opacity-90 shrink-0">Thanks for subscribing!</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={content.placeholder_text || 'Enter your email'} className="flex-1 min-w-60 px-4 py-3 rounded-xl text-slate-900 focus:outline-none" required />
            <button type="submit" className="px-6 py-3 rounded-xl bg-white font-semibold transition-opacity hover:opacity-90 shrink-0" style={{ color: g.primary_color }}>
              {content.button_text || 'Subscribe'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

// ─── Minimal (clean, borderless) ─────────────────────────────────────────────
const NewsletterMinimal: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const padding = style_overrides?.padding || 'py-16';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) { setSubmitted(true); fireConfetti(); }
  };

  return (
    <section className={`${padding} px-4 bg-white`}>
      <div className="max-w-sm mx-auto text-center">
        <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${g.primary_color}15` }}>
          <span className="text-xl">✉</span>
        </div>
        <h2 className="text-xl font-bold mb-2 text-slate-900" style={{ fontFamily: g.font_heading }}>
          {content.heading || 'Get the newsletter'}
        </h2>
        {content.subtext && <p className="text-slate-500 text-sm mb-5" style={{ fontFamily: g.font_body }}>{content.subtext}</p>}
        {submitted ? (
          <p className="font-semibold" style={{ color: g.primary_color }}>You're subscribed!</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={content.placeholder_text || 'your@email.com'} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none text-sm" required />
            <button type="submit" className="w-full px-4 py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: g.primary_color }}>
              {content.button_text || 'Subscribe'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

// ─── Legacy: full_width (kept for backward compat) ────────────────────────────
const NewsletterFullWidth: React.FC<SectionComponentProps> = ({ content, global: g, style_overrides }) => (
  <NewsletterBanner content={content} global={g} style_overrides={style_overrides} />
);

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const NewsletterSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'centered';
  const allProps = { content, ...props };

  if (v === 'full_width' || v === 'banner') return <NewsletterBanner {...allProps} />;
  if (v === 'minimal')                      return <NewsletterMinimal {...allProps} />;
  return <NewsletterCentered {...allProps} />;
};

export default NewsletterSection;
