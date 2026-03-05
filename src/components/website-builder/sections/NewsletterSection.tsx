import React, { useState } from 'react';
import { SectionComponentProps } from '../../../types/website';

const NewsletterSection: React.FC<SectionComponentProps & { variant: string }> = ({
  content,
  global: g,
  style_overrides,
  variant,
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const bg = style_overrides?.background || `linear-gradient(135deg, ${g.primary_color}10 0%, ${g.primary_color}05 100%)`;
  const textColor = style_overrides?.text_color || '#0f172a';
  const padding = style_overrides?.padding || 'py-20';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  if (variant === 'full_width') {
    return (
      <section className={`${padding} px-4`} style={{ background: g.primary_color, color: '#ffffff' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: g.font_heading }}>
            {content.heading || 'Stay in the Loop'}
          </h2>
          {content.subtext && (
            <p className="mb-8 opacity-80 text-lg" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
          )}
          {submitted ? (
            <p className="text-xl font-semibold opacity-90">Thanks for subscribing!</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={content.placeholder_text || 'Enter your email'}
                className="flex-1 px-4 py-3 rounded-xl text-gray-900 focus:outline-none"
                required
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-white font-semibold transition-opacity hover:opacity-90"
                style={{ color: g.primary_color }}
              >
                {content.button_text || 'Subscribe'}
              </button>
            </form>
          )}
        </div>
      </section>
    );
  }

  // Default: minimal
  return (
    <section className={`${padding} px-4`} style={{ background: bg, color: textColor }}>
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontFamily: g.font_heading, color: textColor }}>
          {content.heading || 'Stay Updated'}
        </h2>
        {content.subtext && (
          <p className="mb-6 opacity-70" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        {submitted ? (
          <p className="font-semibold" style={{ color: g.primary_color }}>Thanks! You're on the list.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={content.placeholder_text || 'Your email address'}
              className="flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{ borderColor: `${g.primary_color}40`, outlineColor: g.primary_color }}
              required
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: g.primary_color }}
            >
              {content.button_text || 'Subscribe'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

export default NewsletterSection;
