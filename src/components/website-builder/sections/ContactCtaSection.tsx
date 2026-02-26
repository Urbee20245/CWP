import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { Phone, Mail, Clock } from 'lucide-react';

const SimpleForm: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section id="contact" className="py-20 px-4 bg-slate-50">
    <div className="max-w-3xl mx-auto text-center">
      <h2
        className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      {content.subtext && (
        <p className="text-slate-600 text-lg mb-10" style={{ fontFamily: g.font_body }}>
          {content.subtext}
        </p>
      )}
      <div className="flex flex-col sm:flex-row justify-center gap-8 mt-8">
        {content.phone && (
          <a
            href={`tel:${String(content.phone).replace(/\D/g, '')}`}
            className="flex items-center gap-3 text-lg font-semibold transition-opacity hover:opacity-80"
            style={{ color: g.primary_color }}
          >
            <Phone className="w-6 h-6" />
            {content.phone}
          </a>
        )}
        {content.email && (
          <a
            href={`mailto:${content.email}`}
            className="flex items-center gap-3 text-lg font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <Mail className="w-6 h-6" style={{ color: g.primary_color }} />
            {content.email}
          </a>
        )}
      </div>
      {content.hours && (
        <div className="flex items-center justify-center gap-2 mt-6 text-slate-500 text-sm">
          <Clock className="w-4 h-4" style={{ color: g.primary_color }} />
          {content.hours}
        </div>
      )}
      {(content.cta_primary_text || content.cta_secondary_text) && (
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
          {content.cta_primary_text && (
            <a
              href={content.cta_primary_link || '#contact'}
              className="inline-block px-8 py-3 rounded-xl text-white font-semibold shadow-md transition-transform hover:scale-105"
              style={{ backgroundColor: g.primary_color }}
            >
              {content.cta_primary_text}
            </a>
          )}
          {content.cta_secondary_text && (
            <a
              href={content.cta_secondary_link || '#contact'}
              className="inline-block px-8 py-3 rounded-xl font-semibold border-2 transition-colors hover:bg-slate-50"
              style={{ borderColor: g.primary_color, color: g.primary_color }}
            >
              {content.cta_secondary_text}
            </a>
          )}
        </div>
      )}
    </div>
  </section>
);

const PhoneProminent: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section
    id="contact"
    className="py-24 px-4 text-center text-white"
    style={{ backgroundColor: g.primary_color }}
  >
    <div className="max-w-2xl mx-auto">
      <h2
        className="text-3xl sm:text-4xl font-bold mb-4"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      {content.subtext && (
        <p className="text-lg opacity-90 mb-8" style={{ fontFamily: g.font_body }}>
          {content.subtext}
        </p>
      )}
      {content.phone && (
        <a
          href={`tel:${String(content.phone).replace(/\D/g, '')}`}
          className="inline-flex items-center gap-3 bg-white px-10 py-5 rounded-2xl text-2xl font-extrabold shadow-2xl transition-transform hover:scale-105"
          style={{ color: g.primary_color, fontFamily: g.font_heading }}
        >
          <Phone className="w-7 h-7" />
          {content.phone}
        </a>
      )}
      {content.hours && (
        <p className="mt-6 opacity-80 text-sm">{content.hours}</p>
      )}
      {content.cta_secondary_text && (
        <a
          href={content.cta_secondary_link || '#contact'}
          className="inline-block mt-4 px-8 py-3 rounded-xl font-semibold bg-white/20 border border-white/40 text-white hover:bg-white/30 transition-colors"
        >
          {content.cta_secondary_text}
        </a>
      )}
    </div>
  </section>
);

const SplitContact: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section id="contact" className="py-20 px-4 bg-white">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
      <div>
        <h2
          className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-slate-600 text-lg mb-8" style={{ fontFamily: g.font_body }}>
            {content.subtext}
          </p>
        )}
        <div className="space-y-4">
          {content.phone && (
            <a
              href={`tel:${String(content.phone).replace(/\D/g, '')}`}
              className="flex items-center gap-3 text-lg font-semibold"
              style={{ color: g.primary_color }}
            >
              <Phone className="w-5 h-5" /> {content.phone}
            </a>
          )}
          {content.email && (
            <a
              href={`mailto:${content.email}`}
              className="flex items-center gap-3 text-slate-700 hover:text-slate-900"
            >
              <Mail className="w-5 h-5" style={{ color: g.primary_color }} /> {content.email}
            </a>
          )}
          {content.hours && (
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <Clock className="w-5 h-5" style={{ color: g.primary_color }} /> {content.hours}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-6">
        {(content.cta_primary_text || content.cta_secondary_text) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {content.cta_primary_text && (
              <a
                href={content.cta_primary_link || '#contact'}
                className="inline-block px-8 py-3 rounded-xl text-white font-semibold shadow-md transition-transform hover:scale-105"
                style={{ backgroundColor: g.primary_color }}
              >
                {content.cta_primary_text}
              </a>
            )}
            {content.cta_secondary_text && (
              <a
                href={content.cta_secondary_link || '#contact'}
                className="inline-block px-8 py-3 rounded-xl font-semibold border-2 transition-colors hover:bg-slate-50"
                style={{ borderColor: g.primary_color, color: g.primary_color }}
              >
                {content.cta_secondary_text}
              </a>
            )}
          </div>
        )}
        <div
          className="h-48 rounded-2xl flex items-center justify-center text-xl font-semibold"
          style={{ backgroundColor: `${g.primary_color}15`, color: g.primary_color }}
        >
          We'd love to hear from you
        </div>
      </div>
    </div>
  </section>
);

const MultiStepForm: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section id="contact" className="py-20 px-4 bg-slate-50">
    <div className="max-w-2xl mx-auto text-center">
      <h2
        className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      {content.subtext && (
        <p className="text-slate-600 text-lg mb-10" style={{ fontFamily: g.font_body }}>
          {content.subtext}
        </p>
      )}
      <div className="bg-white rounded-2xl shadow-md p-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Your Name"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: g.primary_color }}
          />
          <input
            type="email"
            placeholder="Email Address"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2"
          />
        </div>
        {content.phone !== undefined && (
          <input
            type="tel"
            placeholder="Phone Number"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2"
          />
        )}
        <textarea
          placeholder="How can we help you?"
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 resize-none"
        />
        <a
          href={content.cta_primary_link || '#contact'}
          className="inline-block w-full px-8 py-4 rounded-xl text-white font-semibold shadow-md transition-transform hover:scale-105"
          style={{ backgroundColor: g.primary_color }}
        >
          {content.cta_primary_text || 'Send Message'}
        </a>
        {content.cta_secondary_text && (
          <a
            href={content.cta_secondary_link || '#contact'}
            className="inline-block w-full px-8 py-3 rounded-xl font-semibold border-2 transition-colors hover:bg-slate-50"
            style={{ borderColor: g.primary_color, color: g.primary_color }}
          >
            {content.cta_secondary_text}
          </a>
        )}
      </div>
    </div>
  </section>
);

const DarkBand: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section id="contact" className="py-20 px-4 bg-slate-900 text-white">
    <div className="max-w-4xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
      <div className="flex-1">
        <h2
          className="text-3xl sm:text-4xl font-bold mb-4"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-slate-300 text-lg" style={{ fontFamily: g.font_body }}>
            {content.subtext}
          </p>
        )}
        {content.hours && (
          <div className="flex items-center gap-2 mt-4 text-slate-400 text-sm">
            <Clock className="w-4 h-4" style={{ color: g.primary_color }} />
            {content.hours}
          </div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
        {content.phone && (
          <a
            href={`tel:${String(content.phone).replace(/\D/g, '')}`}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: g.primary_color }}
          >
            <Phone className="w-5 h-5" />
            {content.phone}
          </a>
        )}
        {content.cta_primary_text && (
          <a
            href={content.cta_primary_link || '#contact'}
            className="inline-block px-8 py-4 rounded-xl text-white font-bold shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: g.primary_color }}
          >
            {content.cta_primary_text}
          </a>
        )}
        {content.cta_secondary_text && (
          <a
            href={content.cta_secondary_link || '#contact'}
            className="inline-block px-8 py-4 rounded-xl font-bold border-2 border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            {content.cta_secondary_text}
          </a>
        )}
      </div>
    </div>
  </section>
);

const ContactCtaSection: React.FC<SectionComponentProps & { variant: string }> = ({ variant, ...props }) => {
  if (variant === 'phone_prominent') return <PhoneProminent {...props} />;
  if (variant === 'split_contact') return <SplitContact {...props} />;
  if (variant === 'multi_step_form') return <MultiStepForm {...props} />;
  if (variant === 'dark_band') return <DarkBand {...props} />;
  return <SimpleForm {...props} />;
};

export default ContactCtaSection;
