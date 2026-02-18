import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, AlertTriangle, Send } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';
import { WebsiteGlobal } from '../../../types/website';

declare global {
  interface Window {
    grecaptcha: any;
    onRecaptchaLoad?: () => void;
  }
}

interface ContactFormSectionProps {
  content: {
    heading?: string;
    subtext?: string;
  };
  global: WebsiteGlobal;
  variant: string;
  siteSlug?: string;
  customDomain?: boolean;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

// ── reCAPTCHA loader ─────────────────────────────────────────────────────────

let recaptchaLoaded = false;
let recaptchaLoadingCallbacks: Array<() => void> = [];

function loadRecaptcha(siteKey: string): Promise<void> {
  return new Promise(resolve => {
    if (recaptchaLoaded) { resolve(); return; }
    recaptchaLoadingCallbacks.push(resolve);
    if (document.querySelector('#recaptcha-script')) return; // already loading

    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => {
      recaptchaLoaded = true;
      recaptchaLoadingCallbacks.forEach(cb => cb());
      recaptchaLoadingCallbacks = [];
    };
    document.head.appendChild(script);
  });
}

// ── Standard variant (white card) ────────────────────────────────────────────

const ContactFormSection: React.FC<ContactFormSectionProps> = ({
  content,
  global: g,
  variant,
  siteSlug,
  customDomain,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string | null>(null);
  const recaptchaReady = useRef(false);

  // Load reCAPTCHA site key from platform_settings (public read)
  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'recaptcha_site_key')
      .single()
      .then(({ data }) => {
        const key = data?.value?.trim();
        if (key) {
          setRecaptchaSiteKey(key);
          loadRecaptcha(key).then(() => { recaptchaReady.current = true; });
        }
      });
  }, []);

  const getRecaptchaToken = async (): Promise<string | null> => {
    if (!recaptchaSiteKey || !recaptchaReady.current || !window.grecaptcha) return null;
    try {
      return await window.grecaptcha.execute(recaptchaSiteKey, { action: 'contact_form' });
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrorMsg('Please enter your name.'); return; }
    if (!email.trim() && !phone.trim()) { setErrorMsg('Please enter an email or phone number.'); return; }

    setStatus('submitting');
    setErrorMsg('');

    const recaptcha_token = await getRecaptchaToken();

    const siteIdentifier = customDomain
      ? { site_hostname: window.location.hostname }
      : { site_slug: siteSlug };

    const { error } = await supabase.functions.invoke('public-contact-form', {
      body: {
        ...siteIdentifier,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        message: message.trim() || null,
        recaptcha_token,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMsg(error.message || 'Something went wrong. Please try again or call us directly.');
    } else {
      setStatus('success');
    }
  };

  const isDark = variant === 'dark';

  const sectionStyle: React.CSSProperties = isDark
    ? { backgroundColor: g.primary_color }
    : { backgroundColor: '#f8fafc' };

  const cardStyle: React.CSSProperties = isDark
    ? { backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }
    : { backgroundColor: '#ffffff', border: '1px solid #e2e8f0' };

  const headingColor = isDark ? '#ffffff' : '#0f172a';
  const subtextColor = isDark ? 'rgba(255,255,255,0.8)' : '#64748b';
  const labelColor   = isDark ? 'rgba(255,255,255,0.9)' : '#475569';
  const inputStyle: React.CSSProperties = isDark
    ? { backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#ffffff' }
    : { backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a' };

  if (status === 'success') {
    return (
      <section id="contact-form" className="py-20 px-4" style={sectionStyle}>
        <div className="max-w-2xl mx-auto text-center">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : `${g.primary_color}15` }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: isDark ? '#ffffff' : g.primary_color }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: headingColor, fontFamily: g.font_heading }}>
            Message Sent!
          </h2>
          <p className="text-lg" style={{ color: subtextColor, fontFamily: g.font_body }}>
            Thanks, we'll be in touch with you shortly.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="contact-form" className="py-20 px-4" style={sectionStyle}>
      <div className="max-w-2xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-10">
          <h2
            className="text-3xl sm:text-4xl font-bold mb-4"
            style={{ color: headingColor, fontFamily: g.font_heading }}
          >
            {content.heading || 'Get In Touch'}
          </h2>
          {content.subtext && (
            <p className="text-lg" style={{ color: subtextColor, fontFamily: g.font_body }}>
              {content.subtext}
            </p>
          )}
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-8 shadow-sm" style={cardStyle}>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: labelColor, fontFamily: g.font_body }}>
                  Name <span style={{ color: g.primary_color }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-all"
                  style={{ ...inputStyle, '--tw-ring-color': g.primary_color } as React.CSSProperties}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: labelColor, fontFamily: g.font_body }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-all"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: labelColor, fontFamily: g.font_body }}>
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 555-5555"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-all"
                style={inputStyle}
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: labelColor, fontFamily: g.font_body }}>
                Message
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="How can we help you?"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-all resize-none"
                style={inputStyle}
              />
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 text-sm" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : g.primary_color, fontFamily: g.font_body }}
            >
              {status === 'submitting' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Message</>
              )}
            </button>

            {recaptchaSiteKey && (
              <p className="text-center text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}>
                Protected by Google reCAPTCHA
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactFormSection;
