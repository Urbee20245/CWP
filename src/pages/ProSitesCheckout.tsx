import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Lock, ArrowRight, ArrowLeft, Phone, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// ─── Pricing Constants ─────────────────────────────────────────────────────────

export const TIER_PRICES = {
  starter: { monthly_cents: 9700,  label: 'Starter', display: '$97/mo'  },
  growth:  { monthly_cents: 14700, label: 'Growth',  display: '$147/mo' },
  pro:     { monthly_cents: 19700, label: 'Pro',     display: '$197/mo' },
  elite:   { monthly_cents: 24700, label: 'Elite',   display: '$247/mo' },
} as const;

export const SETUP_FEE_CENTS = 49700; // $497

// ─── Free Tier Perks ("Human Touch") ──────────────────────────────────────────

const TIER_FREE_PERKS = {
  starter: {
    perk: 'Personal Site Reveal Call',
    detail:
      '30-minute 1-on-1 walkthrough of your completed site with a real team member before launch. We make sure you love it.',
  },
  growth: {
    perk: 'Competitor Snapshot Report',
    detail:
      "We manually research and deliver a written report on 3 of your top local competitors — what they're doing online and where you can win.",
  },
  pro: {
    perk: 'Monthly Performance Check-In',
    detail:
      "Each month we personally review your site's traffic, lead form submissions, and AI activity — then email you a plain-English summary with action tips.",
  },
  elite: {
    perk: 'Quarterly Strategy Call',
    detail:
      'Every 3 months, a 45-minute call with your dedicated account manager to review performance, refresh content, and plan your next moves.',
  },
} as const;

// ─── Tier Feature Lists ────────────────────────────────────────────────────────

const TIER_FEATURES: Record<string, string[]> = {
  starter: [
    'Up to 5 pages (Home, About, Services, FAQ, Contact)',
    'Smart contact form + lead notifications',
    'Google Maps embed + business hours',
    'Mobile-optimized design',
  ],
  growth: [
    'Everything in Starter (up to 6 pages)',
    'Cal.com booking calendar (appointment scheduling)',
    'Live chat widget',
    'Automated blog (2 SEO posts/month)',
    'Legal pages (Privacy Policy + Terms)',
  ],
  pro: [
    'Everything in Growth (up to 8 pages)',
    'AI Website Chat Assistant (trained on your business)',
    '24/7 AI Phone Receptionist (120 FREE min/mo)',
    'Automated blog (4 SEO posts/month)',
  ],
  elite: [
    'Everything in Pro (up to 10 pages)',
    'AI Phone — Inbound + Outbound calling',
    'Weekly blog posts (52 posts/year)',
    'Priority support',
  ],
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type TierKey = keyof typeof TIER_PRICES;

interface AddonCatalogItem {
  id: string;
  key: string;
  name: string;
  description: string;
  monthly_price_cents: number | null;
  setup_fee_cents: number | null;
  billing_type: 'one_time' | 'subscription' | 'setup_plus_subscription';
}

interface FormData {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  industry: string;
  businessDescription: string;
}

// ─── Industries ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Insurance Agent',
  'Real Estate Agent',
  'Law Firm / Attorney',
  'Medical / Healthcare Provider',
  'Med Spa & Aesthetics',
  'Financial Advisor',
  'General Contractor / Home Services',
  'Restaurant & Food Service',
  'Fitness & Wellness',
  'Auto Dealership / Services',
  'Salon & Beauty',
  'Other Professional Service',
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function isBlogAddon(addon: AddonCatalogItem): boolean {
  return (
    addon.key.toLowerCase().includes('blog') ||
    addon.name.toLowerCase().includes('blog')
  );
}

function isAiPhoneAddon(addon: AddonCatalogItem): boolean {
  return addon.key === 'ai_phone_receptionist_with_booking';
}

/** Monthly recurring contribution of an addon (one_time addons = 0). */
function addonMonthlyContribution(addon: AddonCatalogItem): number {
  if (addon.billing_type === 'one_time') return 0;
  return addon.monthly_price_cents ?? 0;
}

function addonPriceLabel(addon: AddonCatalogItem): string {
  if (addon.billing_type === 'one_time') return 'One-time fee';
  if (addon.monthly_price_cents) return `+${centsToDisplay(addon.monthly_price_cents)}/mo`;
  return '';
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ step: number }> = ({ step }) => {
  const steps = ['Your Business', 'Your Plan', 'Review & Pay'];
  return (
    <div className="mb-10">
      <div className="flex items-center justify-center">
        {steps.map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isDone
                      ? 'bg-indigo-600 text-white'
                      : isActive
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : stepNum}
                </div>
                <span
                  className={`mt-1.5 text-xs font-semibold whitespace-nowrap ${
                    isActive ? 'text-indigo-600' : isDone ? 'text-indigo-400' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 w-16 sm:w-24 mx-1 mb-5 transition-all ${
                    step > stepNum ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tier Card ─────────────────────────────────────────────────────────────────

const TierCard: React.FC<{
  tier: TierKey;
  selected: boolean;
  onClick: () => void;
}> = ({ tier, selected, onClick }) => {
  const info = TIER_PRICES[tier];
  const features = TIER_FEATURES[tier] ?? [];
  const perk = TIER_FREE_PERKS[tier];
  const isPopular = tier === 'pro';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full cursor-pointer transition-all rounded-xl border-2 p-4 text-left focus:outline-none ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50'
          : 'border-slate-200 hover:border-indigo-300 bg-white'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
          Most Popular
        </span>
      )}

      <div className={`text-sm font-bold mb-0.5 ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>
        {info.label}
      </div>
      <div className={`text-xl font-black mb-3 ${selected ? 'text-indigo-600' : 'text-slate-900'}`}>
        {info.display}
      </div>

      <ul className="space-y-1.5 mb-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
            <CheckCircle2
              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${selected ? 'text-indigo-500' : 'text-slate-400'}`}
            />
            {f}
          </li>
        ))}
      </ul>

      {/* Free Human Touch perk */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
        <p className="font-bold text-amber-800 mb-0.5">⭐ Free — Included: {perk.perk}</p>
        <p className="text-amber-700 leading-relaxed">{perk.detail}</p>
      </div>
    </button>
  );
};

// ─── Add-On Card ───────────────────────────────────────────────────────────────

const AddonCard: React.FC<{
  addon: AddonCatalogItem;
  selected: boolean;
  blogStyle: boolean;
  wantsTollFree: boolean;
  onToggle: () => void;
  onTollFreeChange: (val: boolean) => void;
}> = ({ addon, selected, blogStyle, wantsTollFree, onToggle, onTollFreeChange }) => {
  const isPhone = isAiPhoneAddon(addon);
  const priceLabel = addonPriceLabel(addon);
  const hasSetupFee =
    addon.setup_fee_cents && addon.setup_fee_cents > 0 && addon.billing_type !== 'one_time';

  return (
    <div>
      {/* Main clickable card */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left cursor-pointer transition-all rounded-xl border p-4 focus:outline-none ${
          selected
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-200 hover:border-indigo-300 bg-white'
        } ${isPhone && 'rounded-b-none border-b-0'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-sm font-semibold ${selected ? 'text-indigo-700' : 'text-slate-700'}`}
              >
                {addon.name}
              </span>
              {isPhone && (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  Includes 120 FREE min/mo (2 hours)
                </span>
              )}
              {blogStyle && (
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                  Choose one
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{addon.description}</p>
            {isPhone && (
              <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                We will provision a dedicated phone number for you — either a toll-free (1-800) or
                local number depending on your preference. No Twilio account needed.
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-sm font-bold ${selected ? 'text-indigo-600' : 'text-slate-500'}`}>
              {priceLabel}
            </span>
            {hasSetupFee && (
              <span className="text-xs text-slate-400 text-right">
                +{centsToDisplay(addon.setup_fee_cents!)} setup
              </span>
            )}
            <div
              className={`w-5 h-5 flex items-center justify-center border-2 transition-all ${
                blogStyle
                  ? `rounded-full ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`
                  : `rounded ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`
              }`}
            >
              {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
          </div>
        </div>
      </button>

      {/* AI Phone provisioning box — always visible for this addon */}
      {isPhone && (
        <div
          className={`rounded-b-xl border border-t-0 px-4 pb-4 pt-3 transition-all ${
            selected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <span className="font-semibold">📞 Don't have a business phone number?</span>
            <span> No problem — we'll set one up for you. Choose between a </span>
            <span className="font-semibold">toll-free (1-800)</span>
            <span> or </span>
            <span className="font-semibold">local area code number</span>
            <span>. No Twilio account or technical setup required on your end.</span>
          </div>
          {selected && (
            <label className="flex items-start gap-2 mt-2 cursor-pointer text-xs text-slate-600">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={wantsTollFree}
                onChange={(e) => onTollFreeChange(e.target.checked)}
              />
              <span>I'd prefer a toll-free (1-800) number</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const ProSitesCheckout: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Step
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Business info form
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    phone: '',
    industry: '',
    businessDescription: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({});

  // Plan selection
  const [selectedTier, setSelectedTier] = useState<TierKey>('starter');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [wantsTollFree, setWantsTollFree] = useState(false);

  // Dynamic addons from API
  const [addons, setAddons] = useState<AddonCatalogItem[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [addonsError, setAddonsError] = useState<string | null>(null);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-select tier from ?tier= URL param
  useEffect(() => {
    const tierParam = searchParams.get('tier');
    if (tierParam && tierParam in TIER_PRICES) {
      setSelectedTier(tierParam as TierKey);
    }
  }, [searchParams]);

  // Fetch addons from edge function on mount
  useEffect(() => {
    const fetchAddons = async () => {
      try {
        setAddonsLoading(true);
        setAddonsError(null);
        const res = await fetch(
          'https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1/get-pro-sites-addons',
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setAddons(json?.addons ?? []);
      } catch (err: any) {
        console.error('[ProSitesCheckout] Failed to load addons:', err);
        setAddonsError(
          'We had trouble loading add-on options. Please refresh the page or contact us at (470) 264-6256.'
        );
      } finally {
        setAddonsLoading(false);
      }
    };
    fetchAddons();
  }, []);

  // ── Pricing Calculations ─────────────────────────────────────────────────────

  const baseMonthlyCents = TIER_PRICES[selectedTier].monthly_cents;

  const addonsMonthlyCents = selectedAddons.reduce((sum, key) => {
    const addon = addons.find((a) => a.key === key);
    return addon ? sum + addonMonthlyContribution(addon) : sum;
  }, 0);

  const totalMonthlyCents = baseMonthlyCents + addonsMonthlyCents;

  const addonSetupFeeCents = selectedAddons.reduce((sum, key) => {
    const addon = addons.find((a) => a.key === key);
    if (!addon || addon.billing_type === 'one_time' || !addon.setup_fee_cents) return sum;
    return sum + addon.setup_fee_cents;
  }, 0);

  const dueTodayCents = SETUP_FEE_CENTS + addonSetupFeeCents + totalMonthlyCents;
  const hasAddonSetupFees = addonSetupFeeCents > 0;

  // ── Addon Toggle ─────────────────────────────────────────────────────────────

  const toggleAddon = (key: string) => {
    const addon = addons.find((a) => a.key === key);
    if (!addon) return;

    setSelectedAddons((prev) => {
      if (isBlogAddon(addon)) {
        const blogKeys = addons.filter(isBlogAddon).map((a) => a.key);
        const withoutBlogs = prev.filter((k) => !blogKeys.includes(k));
        // Toggle off if already selected, else replace blogs with this one
        return prev.includes(key) ? withoutBlogs : [...withoutBlogs, key];
      }
      return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    });

    // Clear toll-free preference when deselecting AI phone
    if (isAiPhoneAddon(addon) && selectedAddons.includes(key)) {
      setWantsTollFree(false);
    }
  };

  // ── Form Validation ──────────────────────────────────────────────────────────

  const validateStep1 = (): boolean => {
    const errors: Partial<FormData> = {};
    if (!formData.firstName.trim()) errors.firstName = 'Required';
    if (!formData.lastName.trim()) errors.lastName = 'Required';
    if (!formData.businessName.trim()) errors.businessName = 'Required';
    if (!formData.email.trim()) errors.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.industry) errors.industry = 'Required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const success_url = `${window.location.origin}/pro-sites/success`;
      const cancel_url = `${window.location.origin}/pro-sites/checkout`;

      const { data, error: fnError } = await supabase.functions.invoke(
        'create-pro-sites-checkout',
        {
          body: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            business_name: formData.businessName,
            email: formData.email,
            phone: formData.phone || undefined,
            industry: formData.industry,
            business_description: formData.businessDescription || undefined,
            tier: selectedTier,
            selected_addons: selectedAddons,
            prefers_toll_free_number: wantsTollFree,
            success_url,
            cancel_url,
          },
        }
      );

      if (fnError) throw new Error(fnError.message || 'Failed to create checkout session.');
      if (!data?.checkout_url) throw new Error('No checkout URL returned.');

      window.location.href = data.checkout_url;
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // ── Derived State ────────────────────────────────────────────────────────────

  const aiPhoneSelected = selectedAddons.some((k) => {
    const a = addons.find((ad) => ad.key === k);
    return a && isAiPhoneAddon(a);
  });

  const selectedAddonObjects = selectedAddons
    .map((k) => addons.find((a) => a.key === k))
    .filter(Boolean) as AddonCatalogItem[];

  const tierPerk = TIER_FREE_PERKS[selectedTier];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            Get Your CWP Pro Site
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Professional AI-built website — ready in 24 hours
          </p>
        </div>

        <ProgressBar step={step} />

        {/* ── Step 1: Your Business ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Tell Us About Your Business</h2>

            <div className="space-y-5">
              {/* Name row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    placeholder="Jane"
                    className={`w-full border rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all ${
                      formErrors.firstName ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.firstName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder="Smith"
                    className={`w-full border rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all ${
                      formErrors.lastName ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  placeholder="Smith Insurance Agency"
                  className={`w-full border rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all ${
                    formErrors.businessName ? 'border-red-400' : 'border-slate-200'
                  }`}
                />
                {formErrors.businessName && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.businessName}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="jane@smithinsurance.com"
                  className={`w-full border rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all ${
                    formErrors.email ? 'border-red-400' : 'border-slate-200'
                  }`}
                />
                {formErrors.email && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Phone Number{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="(470) 555-1234"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                />
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Industry <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all bg-white ${
                    formErrors.industry ? 'border-red-400' : 'border-slate-200'
                  }`}
                >
                  <option value="">— Select your industry —</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
                {formErrors.industry && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.industry}</p>
                )}
              </div>

              {/* Business Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Tell us about your business{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={formData.businessDescription}
                  onChange={(e) => updateField('businessDescription', e.target.value)}
                  placeholder="What services do you offer? Who are your customers?"
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none"
                />
              </div>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl text-base transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
              >
                Continue to Plan Selection
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Plan & Add-Ons ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">

            {/* Header & context */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Choose Your Plan</h2>
              <p className="text-slate-600 text-sm mb-5 leading-relaxed">
                Every CWP Pro Sites plan includes a professionally built website, custom-written
                content, and full configuration — tailored specifically to your industry and
                business. <strong>This is not a template. We build it for you.</strong>
              </p>

              {/* What's always included */}
              <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2">
                  ✅ Included in Every Plan
                </p>
                <ul className="space-y-1.5">
                  {[
                    'Custom AI-built website (pages tailored to your industry)',
                    'Mobile-optimized, fast-loading design',
                    'Smart contact form + lead capture',
                    'SSL certificate + Hosting + Uptime monitoring',
                    'Monthly maintenance & security updates',
                    'You own your content — export or leave anytime',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-indigo-700">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                <p className="text-xs font-bold text-rose-800 mb-1">⚠️ Please Note</p>
                <p className="text-xs text-rose-800 leading-relaxed">
                  CWP Pro Sites is a <strong>website subscription service</strong> — not a CRM,
                  custom development project, or our full-service agency offering. If you need a
                  custom business operating system, client portal, or advanced automation platform,
                  visit our main services page.
                </p>
              </div>
            </div>

            {/* Tier Cards */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h3 className="text-base font-bold text-slate-800 mb-4">Select Your Monthly Plan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(TIER_PRICES) as TierKey[]).map((tier) => (
                  <TierCard
                    key={tier}
                    tier={tier}
                    selected={selectedTier === tier}
                    onClick={() => setSelectedTier(tier)}
                  />
                ))}
              </div>
            </div>

            {/* Add-Ons */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h3 className="text-base font-bold text-slate-800 mb-1">Customize With Add-Ons</h3>
              <p className="text-slate-500 text-sm mb-5">
                Optional features you can add to any plan. Select as many as you'd like.
              </p>

              {/* Loading state */}
              {addonsLoading && (
                <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading add-on options...</span>
                </div>
              )}

              {/* Error state */}
              {addonsError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  {addonsError}
                </div>
              )}

              {/* Addon list */}
              {!addonsLoading && !addonsError && addons.length > 0 && (
                <div className="space-y-3">
                  {addons.map((addon) => (
                    <AddonCard
                      key={addon.key}
                      addon={addon}
                      selected={selectedAddons.includes(addon.key)}
                      blogStyle={isBlogAddon(addon)}
                      wantsTollFree={wantsTollFree}
                      onToggle={() => toggleAddon(addon.key)}
                      onTollFreeChange={setWantsTollFree}
                    />
                  ))}
                </div>
              )}

              {/* Running Total */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>{TIER_PRICES[selectedTier].label} Plan</span>
                    <span className="font-semibold">{centsToDisplay(baseMonthlyCents)}/mo</span>
                  </div>
                  {addonsMonthlyCents > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Add-ons</span>
                      <span className="font-semibold">
                        +{centsToDisplay(addonsMonthlyCents)}/mo
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>One-time setup fee (website build)</span>
                    <span>+{centsToDisplay(SETUP_FEE_CENTS)}</span>
                  </div>
                  {hasAddonSetupFees && (
                    <p className="text-xs text-slate-400 text-right">
                      Additional setup fees may apply for selected add-ons
                    </p>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
                    <div>
                      <span>Monthly Subscription Total</span>
                      <p className="text-xs font-normal text-slate-400 mt-0.5">
                        Billed on a recurring basis
                      </p>
                    </div>
                    <span className="text-indigo-600">{centsToDisplay(totalMonthlyCents)}/mo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 font-semibold text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-base transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
              >
                Review My Order
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Pay ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Review Your Order</h2>

              {/* Business summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5">
                <p className="font-bold text-slate-900">{formData.businessName}</p>
                <p className="text-slate-500 text-sm">{formData.industry}</p>
              </div>

              {/* Free perk callout */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                <p className="text-sm font-bold text-amber-800">
                  ⭐ Your Free Included Perk: {tierPerk.perk}
                </p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">{tierPerk.detail}</p>
              </div>

              {/* ── DUE TODAY ─────────────────────────────────────────── */}
              <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-5 mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-3">Charged Today</p>
                <div className="space-y-2 text-sm">
                  {/* Website setup fee */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">Website Build &amp; Setup Fee</p>
                      <p className="text-slate-500 text-xs mt-0.5">AI-built site, integrations, testing &amp; launch</p>
                    </div>
                    <span className="font-bold text-slate-900 whitespace-nowrap ml-4">{centsToDisplay(SETUP_FEE_CENTS)}</span>
                  </div>
                  {/* Addon setup fees */}
                  {selectedAddonObjects.filter(a => a.setup_fee_cents && a.billing_type !== 'one_time').map((addon) => (
                    <div key={addon.key + '_setup'} className="flex justify-between items-center">
                      <p className="text-slate-600">{addon.name} — Setup</p>
                      <span className="font-semibold text-slate-800 whitespace-nowrap ml-4">+{centsToDisplay(addon.setup_fee_cents!)}</span>
                    </div>
                  ))}
                  {/* First month */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">First Month ({TIER_PRICES[selectedTier].label} Plan{addonsMonthlyCents > 0 ? ' + Add-ons' : ''})</p>
                      <p className="text-slate-500 text-xs mt-0.5">Hosting, maintenance &amp; active features</p>
                    </div>
                    <span className="font-bold text-slate-900 whitespace-nowrap ml-4">{centsToDisplay(totalMonthlyCents)}</span>
                  </div>
                </div>
                <div className="border-t border-emerald-300 mt-3 pt-3 flex justify-between items-center">
                  <p className="font-black text-slate-900 text-base">Total Due Today</p>
                  <span className="text-2xl font-black text-emerald-700">{centsToDisplay(dueTodayCents)}</span>
                </div>
              </div>

              {/* ── RECURRING MONTHLY ─────────────────────────────────────── */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Then Monthly — Starting 30 Days After Signup</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-slate-700">{TIER_PRICES[selectedTier].label} Plan</p>
                    <span className="text-slate-800 font-semibold">{centsToDisplay(baseMonthlyCents)}/mo</span>
                  </div>
                  {selectedAddonObjects.filter(a => addonMonthlyContribution(a) > 0).map((addon) => (
                    <div key={addon.key + '_mo'} className="flex justify-between items-center">
                      <p className="text-slate-600">
                        {isAiPhoneAddon(addon) ? '24/7 AI Phone (120 FREE min/mo — 2 hrs)' : addon.name}
                      </p>
                      <span className="text-slate-700 font-semibold whitespace-nowrap ml-4">+{centsToDisplay(addonMonthlyContribution(addon))}/mo</span>
                    </div>
                  ))}
                  {aiPhoneSelected && wantsTollFree && (
                    <p className="text-xs text-blue-700 pl-2">📞 Phone number preference: Toll-free (1-800)</p>
                  )}
                </div>
                <div className="border-t border-indigo-200 mt-3 pt-3 flex justify-between items-center">
                  <p className="font-black text-slate-900 text-base">Monthly Total</p>
                  <span className="text-2xl font-black text-indigo-600">{centsToDisplay(totalMonthlyCents)}<span className="text-sm font-semibold">/mo</span></span>
                </div>
                <p className="text-xs text-indigo-500 mt-2 text-center">Cancel anytime. No long-term contract.</p>
              </div>

              {/* Subscription disclaimer */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500 leading-relaxed">
                Website subscription service. Setup fee covers your site build. Monthly fee covers hosting, maintenance &amp; active features. Add-on setup fees are one-time charges for initial configuration.
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* CTA */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="mt-7 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating your checkout...
                  </>
                ) : (
                  <>
                    Complete Purchase &amp; Go to Checkout
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="mt-3 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <Lock className="w-3.5 h-3.5" />
                Secure checkout powered by Stripe
              </div>
            </div>

            {/* Back button */}
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 font-semibold text-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Edit My Order
            </button>

            {/* Contact */}
            <div className="text-center">
              <a
                href="tel:4702646256"
                className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm transition-colors"
              >
                <Phone className="w-4 h-4" />
                Questions? Call us at (470) 264-6256
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProSitesCheckout;
