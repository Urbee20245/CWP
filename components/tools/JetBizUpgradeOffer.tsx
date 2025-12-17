import React, { useMemo, useState } from 'react';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';

const UPGRADE_CONTEXT_KEY = 'jetbiz_upgrade_context_v1';

type RadiusMeters = 1609 | 3219 | 4828 | 8047;

function metersToMiles(m: number) {
  return Math.round((m / 1609.34) * 10) / 10;
}

export interface JetBizUpgradeOfferProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  location: string;
  liteScore: number;
  competitorRadiusMeters: RadiusMeters;
}

export const JetBizUpgradeOffer: React.FC<JetBizUpgradeOfferProps> = ({
  isOpen,
  onClose,
  businessName,
  location,
  liteScore,
  competitorRadiusMeters,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const miles = useMemo(() => metersToMiles(competitorRadiusMeters), [competitorRadiusMeters]);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setIsSubmitting(true);
    setError(null);

    const origin = window.location.origin;

    // Save context locally so the Pro page can preload fields instantly.
    try {
      localStorage.setItem(
        UPGRADE_CONTEXT_KEY,
        JSON.stringify({
          businessName,
          location,
          liteScore,
          competitorRadiusMeters,
          createdAt: new Date().toISOString(),
        })
      );
    } catch {
      // ignore
    }

    try {
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          business_name: businessName,
          location,
          lite_score: liteScore,
          competitor_radius: competitorRadiusMeters,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(data?.error || 'Unable to start checkout');
      }
      if (!data?.url) throw new Error('Missing checkout URL');
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || 'Unable to start checkout');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-600 to-purple-600" />

        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">JetBiz Pro Upgrade</div>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">But is this accurate?</h3>
              <p className="text-slate-600 mt-2">
                Your self-assessment score: <span className="font-bold">{Math.round(liteScore)}/100</span>
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="font-bold text-slate-900 mb-3">Get the REAL data:</div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                Automated Google Places API analysis
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                Compare against top 10 competitors within {miles} miles
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                Step-by-step fix instructions
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                Downloadable PDF report
              </li>
            </ul>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-slate-600">
                <span className="line-through">Normally $99</span> → <span className="font-bold text-slate-900">Today: $49 one-time</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">Secure checkout via Stripe</div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={isSubmitting}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all duration-300 disabled:opacity-70 disabled:cursor-wait"
          >
            {isSubmitting ? 'Redirecting…' : 'Upgrade to Pro – $49'}
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="mt-4 text-[11px] text-slate-500">
            Metadata sent: business name, location, Lite score, and competitor radius.
          </div>
        </div>
      </div>
    </div>
  );
};

