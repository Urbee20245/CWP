import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Lock, ArrowRight, ArrowLeft, Phone } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// ─── Pricing Constants ─────────────────────────────────────────────────────────

export const TIER_PRICES = {
  starter: { monthly_cents: 9700, label: 'Starter', display: '$97/mo' },
  growth:  { monthly_cents: 14700, label: 'Growth',  display: '$147/mo' },
  pro:     { monthly_cents: 19700, label: 'Pro',     display: '$197/mo' },
  elite:   { monthly_cents: 24700, label: 'Elite',   display: '$247/mo' },
} as const;

export const SETUP_FEE_CENTS = 49700; // $497

export const PROSITES_ADDONS = [
  {
    key: 'ai_phone_inbound',
    name: 'AI Phone Receptionist — Inbound',
    description: '24/7 AI answers calls, qualifies leads, books appointments. Includes 135 FREE minutes/month.',
    monthly_cents: 5000,
    display: '+$50/mo',
    badge: '135 min FREE',
    included_in: ['pro', 'elite'],
  },
  {
    key: 'ai_phone_outbound',
    name: 'AI Phone Receptionist — Outbound',
    description: 'AI follows up with leads automatically via outbound calls.',
    monthly_cents: 3000,
    display: '+$30/mo',
    badge: null,
    included_in: ['elite'],
  },
  {
    key: 'ai_chatbot',
    name: 'AI Chatbot',
    description: 'Trained on your business — handles FAQs and captures leads automatically.',
    monthly_cents: 4000,
    display: '+$40/mo',
    badge: 'Popular',
    included_in: ['pro', 'elite'],
  },
  {
    key: 'cal_booking',
    name: 'Cal.com Booking Calendar',
    description: 'Let clients schedule appointments directly on your website.',
    monthly_cents: 2000,
    display: '+$20/mo',
    badge: null,
    included_in: ['growth', 'pro', 'elite'],
  },
  {
    key: 'chat_widget',
    name: 'Live Chat Widget',
    description: 'Real-time messaging so website visitors can reach you instantly.',
    monthly_cents: 1500,
    display: '+$15/mo',
    badge: null,
    included_in: ['growth', 'pro', 'elite'],
  },
  {
    key: 'blog_2x',
    name: 'Blog Automation (2 posts/month)',
    description: 'AI-generated, SEO-optimized blog posts published automatically.',
    monthly_cents: 3000,
    display: '+$30/mo',
    badge: null,
    included_in: ['growth', 'pro', 'elite'],
  },
  {
    key: 'blog_4x',
    name: 'Blog Automation (4 posts/month)',
    description: 'Doubles your content output — 4 posts per month on autopilot.',
    monthly_cents: 5000,
    display: '+$50/mo',
    badge: null,
    included_in: ['pro', 'elite'],
  },
  {
    key: 'blog_weekly',
    name: 'Weekly Blog Posts (auto-published)',
    description: 'Maximum content velocity — a new post every single week.',
    monthly_cents: 8000,
    display: '+$80/mo',
    badge: null,
    included_in: ['elite'],
  },
  {
    key: 'legal_pages',
    name: 'Legal Pages Bundle',
    description: 'AI-generated Privacy Policy, Terms & Conditions, and Refund Policy.',
    monthly_cents: 1500,
    display: '+$15/mo',
    badge: null,
    included_in: ['growth', 'pro', 'elite'],
  },
  {
    key: 'google_calendar',
    name: 'Google Calendar Sync',
    description: 'Sync appointments with your existing Google Calendar.',
    monthly_cents: 1000,
    display: '+$10/mo',
    badge: null,
    included_in: [],
  },
  {
    key: 'client_backoffice',
    name: 'Client Back Office Portal',
    description: 'Private admin portal on your domain to manage your site content.',
    monthly_cents: 2500,
    display: '+$25/mo',
    badge: null,
    included_in: [],
  },
] as const;

type TierKey = keyof typeof TIER_PRICES;
type AddonKey = typeof PROSITES_ADDONS[number]['key'];

const BLOG_ADDON_KEYS: AddonKey[] = ['blog_2x', 'blog_4x', 'blog_weekly'];

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

// ─── Helper ───────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function isAddonIncluded(addonKey: AddonKey, tier: TierKey): boolean {
  const addon = PROSITES_ADDONS.find(a => a.key === addonKey);
  return addon ? (addon.included_in as readonly string[]).includes(tier) : false;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ step: number }> = ({ step }) => {
  const steps = ['Your Business', 'Your Plan', 'Review & Pay'];
  return (
    <div className="mb-10">
      <div className="flex items-center justify-center gap-0">
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

// ─── Tier Card ────────────────────────────────────────────────────────────────

const TierCard: React.FC<{
  tier: TierKey;
  selected: boolean;
  onClick: () => void;
}> = ({ tier, selected, onClick }) => {
  const info = TIER_PRICES[tier];
  const isPopular = tier === 'pro';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 cursor-pointer transition-all rounded-xl border-2 p-4 text-left focus:outline-none ${
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
      <div className={`text-sm font-bold mb-1 ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>
        {info.label}
      </div>
      <div className={`text-lg font-black ${selected ? 'text-indigo-600' : 'text-slate-900'}`}>
        {info.display}
      </div>
    </button>
  );
};

// ─── Add-On Card ─────────────────────────────────────────────────────────────

const AddonCard: React.FC<{
  addonKey: AddonKey;
  selectedTier: TierKey;
  selected: boolean;
  isBlogSelected: boolean;
  onToggle: () => void;
}> = ({ addonKey, selectedTier, selected, isBlogSelected, onToggle }) => {
  const addon = PROSITES_ADDONS.find(a => a.key === addonKey)!;
  const included = isAddonIncluded(addonKey, selectedTier);
  const isBlog = BLOG_ADDON_KEYS.includes(addonKey);

  if (included) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 opacity-70">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-600">{addon.name}</span>
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Included in your plan
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{addon.description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left cursor-pointer transition-all rounded-xl border p-4 focus:outline-none ${
        selected
          ? 'border-indigo-400 bg-indigo-50'
          : 'border-slate-200 hover:border-indigo-300 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>
              {addon.name}
            </span>
            {addon.badge && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {addon.badge}
              </span>
            )}
            {isBlog && (
              <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                Choose one
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{addon.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-sm font-bold ${selected ? 'text-indigo-600' : 'text-slate-500'}`}>
            {addon.display}
          </span>
          <div
            className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
              isBlog
                ? selected
                  ? 'rounded-full bg-indigo-600 border-indigo-600'
                  : 'rounded-full border-slate-300'
                : selected
                ? 'bg-indigo-600 border-indigo-600'
                : 'border-slate-300'
            }`}
          >
            {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
          </div>
        </div>
      </div>
    </button>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface FormData {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  industry: string;
  businessDescription: string;
}

const ProSitesCheckout: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    phone: '',
    industry: '',
    businessDescription: '',
  });
  const [selectedTier, setSelectedTier] = useState<TierKey>('starter');
  const [selectedAddons, setSelectedAddons] = useState<AddonKey[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({});

  // Pre-select tier from URL param
  useEffect(() => {
    const tierParam = searchParams.get('tier');
    if (tierParam && tierParam in TIER_PRICES) {
      setSelectedTier(tierParam as TierKey);
    }
  }, [searchParams]);

  // ── Pricing Calculations ────────────────────────────────────────────────────

  const addonsMonthlyCents = selectedAddons.reduce((sum, key) => {
    if (isAddonIncluded(key, selectedTier)) return sum;
    const addon = PROSITES_ADDONS.find(a => a.key === key);
    return sum + (addon?.monthly_cents ?? 0);
  }, 0);

  const baseMonthlyCents = TIER_PRICES[selectedTier].monthly_cents;
  const totalMonthlyCents = baseMonthlyCents + addonsMonthlyCents;

  // ── Addon Toggle ────────────────────────────────────────────────────────────

  const toggleAddon = (key: AddonKey) => {
    if (isAddonIncluded(key, selectedTier)) return;

    setSelectedAddons(prev => {
      const isBlog = BLOG_ADDON_KEYS.includes(key);
      if (isBlog) {
        // Radio-style: deselect other blog addons
        const withoutBlogs = prev.filter(k => !BLOG_ADDON_KEYS.includes(k));
        if (prev.includes(key)) {
          // Deselect if already selected
          return withoutBlogs;
        }
        return [...withoutBlogs, key];
      }
      // Checkbox style
      return prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
    });
  };

  // When tier changes, remove addons that are now included (they don't need to stay selected)
  const handleTierChange = (tier: TierKey) => {
    setSelectedTier(tier);
    // Filter out addons that are now included in the new tier (no need to keep selected)
    setSelectedAddons(prev =>
      prev.filter(key => !isAddonIncluded(key, tier))
    );
  };

  // ── Form Validation ─────────────────────────────────────────────────────────

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

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const success_url = `${window.location.origin}/pro-sites/success`;
      const cancel_url = `${window.location.origin}/pro-sites/checkout`;

      const { data, error: fnError } = await supabase.functions.invoke('create-pro-sites-checkout', {
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
          success_url,
          cancel_url,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to create checkout session.');
      if (!data?.checkout_url) throw new Error('No checkout URL returned.');

      window.location.href = data.checkout_url;
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            Get Your CWP Pro Site
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Professional AI-built website — ready in 24 hours
          </p>
        </div>

        <ProgressBar step={step} />

        {/* ── Step 1: Your Business ─────────────────────────────────────────── */}
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
                    onChange={e => updateField('firstName', e.target.value)}
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
                    onChange={e => updateField('lastName', e.target.value)}
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
                  onChange={e => updateField('businessName', e.target.value)}
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
                  onChange={e => updateField('email', e.target.value)}
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
                  Phone Number <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => updateField('phone', e.target.value)}
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
                  onChange={e => updateField('industry', e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all bg-white ${
                    formErrors.industry ? 'border-red-400' : 'border-slate-200'
                  }`}
                >
                  <option value="">— Select your industry —</option>
                  {INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
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
                  onChange={e => updateField('businessDescription', e.target.value)}
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

        {/* ── Step 2: Plan & Add-Ons ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Tier Selection */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Choose Your Plan</h2>
              <p className="text-slate-500 text-sm mb-6">Select the tier that fits your business.</p>

              <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                {(Object.keys(TIER_PRICES) as TierKey[]).map(tier => (
                  <TierCard
                    key={tier}
                    tier={tier}
                    selected={selectedTier === tier}
                    onClick={() => handleTierChange(tier)}
                  />
                ))}
              </div>
            </div>

            {/* Add-Ons */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Customize With Add-Ons</h2>
              <p className="text-slate-500 text-sm mb-6">
                Add-ons included in your plan are highlighted. Select any extras you'd like.
              </p>

              <div className="space-y-3">
                {PROSITES_ADDONS.map(addon => (
                  <AddonCard
                    key={addon.key}
                    addonKey={addon.key}
                    selectedTier={selectedTier}
                    selected={selectedAddons.includes(addon.key)}
                    isBlogSelected={BLOG_ADDON_KEYS.some(k => selectedAddons.includes(k))}
                    onToggle={() => toggleAddon(addon.key)}
                  />
                ))}
              </div>

              {/* Running Total */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Base Plan ({TIER_PRICES[selectedTier].label})</span>
                    <span className="font-semibold">{centsToDisplay(baseMonthlyCents)}/mo</span>
                  </div>
                  {addonsMonthlyCents > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Add-ons</span>
                      <span className="font-semibold">+{centsToDisplay(addonsMonthlyCents)}/mo</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>One-time setup fee</span>
                    <span>+{centsToDisplay(SETUP_FEE_CENTS)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
                    <span>Monthly Total</span>
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

        {/* ── Step 3: Review & Pay ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Review Your Order</h2>

              {/* Business Summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="font-bold text-slate-900">{formData.businessName}</p>
                <p className="text-slate-500 text-sm">{formData.industry}</p>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex justify-between items-start text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">One-time Setup Fee</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Covers AI website build, all integrations, testing &amp; launch
                    </p>
                  </div>
                  <span className="font-bold text-slate-900 whitespace-nowrap ml-4">
                    {centsToDisplay(SETUP_FEE_CENTS)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <p className="font-semibold text-slate-800">
                    Monthly Plan — {TIER_PRICES[selectedTier].label}
                  </p>
                  <span className="font-bold text-slate-900">
                    {centsToDisplay(baseMonthlyCents)}/mo
                  </span>
                </div>

                {selectedAddons.filter(k => !isAddonIncluded(k, selectedTier)).map(key => {
                  const addon = PROSITES_ADDONS.find(a => a.key === key)!;
                  return (
                    <div key={key} className="flex justify-between items-center text-sm pl-3 border-l-2 border-indigo-200">
                      <p className="text-slate-600">{addon.name}</p>
                      <span className="text-slate-700 font-semibold">{addon.display}</span>
                    </div>
                  );
                })}

                <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">Monthly Total</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Your first month + setup fee is charged today. Cancel anytime.
                    </p>
                  </div>
                  <span className="text-xl font-black text-indigo-600">
                    {centsToDisplay(totalMonthlyCents)}/mo
                  </span>
                </div>
              </div>

              {/* AI Phone callout */}
              {(selectedAddons.includes('ai_phone_inbound') ||
                isAddonIncluded('ai_phone_inbound', selectedTier)) && (
                <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <span className="text-xl">🎙️</span>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    <strong>AI Phone includes 135 FREE minutes every month.</strong> We handle all
                    setup and configuration.
                  </p>
                </div>
              )}

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
                    <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
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

            {/* Questions */}
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
