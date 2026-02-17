import React from 'react';
import { Check } from 'lucide-react';
import { WebsiteGlobal } from '../../../types/website';

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta_text: string;
  highlighted?: boolean;
}

interface PricingSectionProps {
  content: {
    heading: string;
    subtext: string;
    tiers: PricingTier[];
  };
  global: WebsiteGlobal;
  variant: string;
}

const PricingSection: React.FC<PricingSectionProps> = ({ content, global: g, variant }) => {
  const tiers: PricingTier[] = content.tiers || [];
  const cols = tiers.length === 2 ? 'sm:grid-cols-2 max-w-3xl' : 'sm:grid-cols-3';

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14">
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: g.font_heading }}
          >
            {content.heading}
          </h2>
          {content.subtext && (
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">{content.subtext}</p>
          )}
        </div>

        {/* Tier cards */}
        <div className={`grid gap-8 mx-auto ${cols}`}>
          {tiers.map((tier, i) => (
            <div
              key={i}
              className={`relative flex flex-col rounded-2xl border-2 overflow-hidden transition-shadow ${
                tier.highlighted
                  ? 'shadow-2xl scale-105'
                  : 'border-slate-200 shadow-sm hover:shadow-md'
              }`}
              style={tier.highlighted ? { borderColor: g.primary_color } : {}}
            >
              {tier.highlighted && (
                <div
                  className="text-center py-2 text-sm font-semibold text-white tracking-wide"
                  style={{ backgroundColor: g.primary_color }}
                >
                  Most Popular
                </div>
              )}

              <div className="p-8 flex flex-col flex-1">
                {/* Tier name */}
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ color: tier.highlighted ? g.primary_color : '#1e293b', fontFamily: g.font_heading }}
                >
                  {tier.name}
                </h3>
                <p className="text-slate-500 text-sm mb-6">{tier.description}</p>

                {/* Price */}
                <div className="mb-8">
                  <span
                    className="text-5xl font-extrabold"
                    style={{ color: g.primary_color, fontFamily: g.font_heading }}
                  >
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-slate-400 text-sm ml-1">/{tier.period}</span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-8">
                  {(tier.features || []).map((feature, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-slate-600">
                      <Check
                        className="w-4 h-4 flex-shrink-0 mt-0.5"
                        style={{ color: g.primary_color }}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href={g.phone ? `tel:${g.phone.replace(/\D/g, '')}` : '#contact'}
                  className="block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
                  style={
                    tier.highlighted
                      ? { backgroundColor: g.primary_color, color: '#ffffff' }
                      : { border: `2px solid ${g.primary_color}`, color: g.primary_color, backgroundColor: 'transparent' }
                  }
                >
                  {tier.cta_text || 'Get Started'}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
