import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { WebsiteGlobal } from '../../../types/website';

interface PricingTier {
  name: string;
  price: string;
  price_annual?: string;
  period: string;
  description: string;
  features: string[];
  cta_text: string;
  highlighted?: boolean;
}

interface PricingSectionProps {
  content: { heading: string; subtext: string; tiers: PricingTier[] };
  global: WebsiteGlobal;
  variant?: string;
}

// ─── Shared Tier Card ─────────────────────────────────────────────────────────
const TierCard: React.FC<{ tier: PricingTier; g: WebsiteGlobal; displayPrice?: string }> = ({ tier, g, displayPrice }) => (
  <div
    className={`relative flex flex-col rounded-2xl border-2 overflow-hidden transition-shadow ${
      tier.highlighted ? 'shadow-2xl scale-105' : 'border-slate-200 shadow-sm hover:shadow-md'
    }`}
    style={tier.highlighted ? { borderColor: g.primary_color } : {}}
  >
    {tier.highlighted && (
      <div className="text-center py-2 text-sm font-semibold text-white tracking-wide" style={{ backgroundColor: g.primary_color }}>
        Most Popular
      </div>
    )}
    <div className="p-8 flex flex-col flex-1">
      <h3 className="text-xl font-bold mb-2" style={{ color: tier.highlighted ? g.primary_color : '#1e293b', fontFamily: g.font_heading }}>
        {tier.name}
      </h3>
      <p className="text-slate-500 text-sm mb-6">{tier.description}</p>
      <div className="mb-8">
        <span className="text-5xl font-extrabold" style={{ color: g.primary_color, fontFamily: g.font_heading }}>
          {displayPrice || tier.price}
        </span>
        {tier.period && <span className="text-slate-400 text-sm ml-1">/{tier.period}</span>}
      </div>
      <ul className="space-y-3 flex-1 mb-8">
        {(tier.features || []).map((feature, j) => (
          <li key={j} className="flex items-start gap-3 text-sm text-slate-600">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: g.primary_color }} />
            {feature}
          </li>
        ))}
      </ul>
      <a
        href="#contact"
        className="block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
        style={tier.highlighted
          ? { backgroundColor: g.primary_color, color: '#ffffff' }
          : { border: `2px solid ${g.primary_color}`, color: g.primary_color, backgroundColor: 'transparent' }
        }
      >
        {tier.cta_text || 'Get Started'}
      </a>
    </div>
  </div>
);

// ─── Cards (default) ──────────────────────────────────────────────────────────
const PricingCards: React.FC<PricingSectionProps> = ({ content, global: g }) => {
  const tiers: PricingTier[] = content.tiers || [];
  const cols = tiers.length === 2 ? 'sm:grid-cols-2 max-w-3xl' : 'sm:grid-cols-3';

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
          {content.subtext && <p className="text-lg text-slate-500 max-w-2xl mx-auto">{content.subtext}</p>}
        </div>
        <div className={`grid gap-8 mx-auto ${cols}`}>
          {tiers.map((tier, i) => <TierCard key={i} tier={tier} g={g} />)}
        </div>
      </div>
    </section>
  );
};

// ─── Toggle (monthly / annual) ────────────────────────────────────────────────
const PricingToggle: React.FC<PricingSectionProps> = ({ content, global: g }) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const tiers: PricingTier[] = content.tiers || [];
  const cols = tiers.length === 2 ? 'sm:grid-cols-2 max-w-3xl' : 'sm:grid-cols-3';

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
          {content.subtext && <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-8">{content.subtext}</p>}
          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
              style={{ backgroundColor: !isAnnual ? g.primary_color : 'transparent', color: !isAnnual ? '#fff' : '#64748b' }}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
              style={{ backgroundColor: isAnnual ? g.primary_color : 'transparent', color: isAnnual ? '#fff' : '#64748b' }}
            >
              Annual <span className="ml-1 text-xs opacity-80">Save 20%</span>
            </button>
          </div>
        </div>
        <div className={`grid gap-8 mx-auto ${cols}`}>
          {tiers.map((tier, i) => (
            <TierCard key={i} tier={tier} g={g} displayPrice={isAnnual && tier.price_annual ? tier.price_annual : tier.price} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Comparison Table ─────────────────────────────────────────────────────────
const PricingComparisonTable: React.FC<PricingSectionProps> = ({ content, global: g }) => {
  const tiers: PricingTier[] = content.tiers || [];
  // Collect all unique features across tiers
  const allFeatures = Array.from(new Set(tiers.flatMap(t => t.features || [])));

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
          {content.subtext && <p className="text-lg text-slate-500 max-w-2xl mx-auto">{content.subtext}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-4 text-slate-500 font-medium text-sm w-1/3">Feature</th>
                {tiers.map((tier, i) => (
                  <th key={i} className="p-4 text-center">
                    <div className="font-bold text-slate-900 mb-1" style={{ fontFamily: g.font_heading }}>{tier.name}</div>
                    <div className="text-2xl font-extrabold" style={{ color: g.primary_color }}>{tier.price}</div>
                    {tier.period && <div className="text-xs text-slate-400">/{tier.period}</div>}
                    {tier.highlighted && (
                      <span className="inline-block mt-2 px-2 py-0.5 text-xs text-white rounded-full" style={{ backgroundColor: g.primary_color }}>Popular</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatures.map((feature, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="p-4 text-sm text-slate-600">{feature}</td>
                  {tiers.map((tier, j) => (
                    <td key={j} className="p-4 text-center">
                      {(tier.features || []).includes(feature)
                        ? <Check className="w-5 h-5 mx-auto" style={{ color: g.primary_color }} />
                        : <span className="text-slate-300 text-lg">—</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-4" />
                {tiers.map((tier, i) => (
                  <td key={i} className="p-4 text-center">
                    <a href="#contact" className="inline-block px-6 py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
                      style={tier.highlighted ? { backgroundColor: g.primary_color, color: '#fff' } : { border: `2px solid ${g.primary_color}`, color: g.primary_color }}>
                      {tier.cta_text || 'Get Started'}
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const PricingSection: React.FC<PricingSectionProps> = ({ variant, content, global: g }) => {
  const v = variant || content?.tiers ? (variant || 'cards') : 'cards';

  if (v === 'toggle')            return <PricingToggle content={content} global={g} />;
  if (v === 'comparison_table')  return <PricingComparisonTable content={content} global={g} />;
  return <PricingCards content={content} global={g} />;
};

export default PricingSection;
