import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

const BULLETS = [
  'Live in 24 hours — we build it, you approve it',
  'Industry-specific design and pages',
  'Add-ons like AI phone, booking, blog automation',
  'Cancel anytime, no long-term contracts',
];

const INDUSTRY_PILLS = ['Insurance Agent', 'Real Estate Agent', 'Law Firm / Attorney', 'Med Spa & Aesthetics'];
const PRICE_PILLS = ['$97/mo', '$147/mo', '$197/mo', '$247/mo'];

const ProSitesFeature: React.FC = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* ── Left: Text Content ── */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              NEW — CWP Pro Sites
            </div>

            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight mb-4">
              Professional Website + Monthly Subscription.{' '}
              <span className="text-indigo-600">Built for Your Industry.</span>
            </h2>

            <p className="text-slate-500 text-base leading-relaxed mb-8">
              Skip the $3,000–$5,000 custom build. Get an AI-built professional website tailored to your industry for a <strong className="text-slate-700">$497 setup fee</strong>, then just{' '}
              <strong className="text-slate-700">$97–$247/month</strong> based on the features you need.
            </p>

            {/* Feature Bullets */}
            <ul className="space-y-3 mb-8">
              {BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-slate-700 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  {bullet}
                </li>
              ))}
            </ul>

            <Link
              to="/pro-sites"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-7 py-3.5 rounded-full text-sm transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              Explore CWP Pro Sites
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* ── Right: Stylized Feature Card ── */}
          <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl">
            {/* Industry selector preview */}
            <div className="mb-6">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
                Select Your Industry
              </p>
              <div className="flex flex-wrap gap-2">
                {INDUSTRY_PILLS.map((pill, idx) => (
                  <span
                    key={pill}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                      idx === 0
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800 my-6" />

            {/* Pricing preview */}
            <div className="mb-6">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
                Monthly Pricing
              </p>
              <div className="flex flex-wrap gap-2">
                {PRICE_PILLS.map((price, idx) => (
                  <span
                    key={price}
                    className={`text-sm font-bold px-4 py-2 rounded-full ${
                      idx === 2
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {price}
                    {idx === 2 && (
                      <span className="ml-1.5 text-[10px] font-semibold bg-white/20 rounded-full px-1.5 py-0.5 align-middle">
                        Popular
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom note */}
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <p className="text-slate-300 text-xs font-medium text-center leading-relaxed">
                Includes hosting, SSL, maintenance & support
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProSitesFeature;
