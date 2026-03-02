import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Clock,
  Globe,
  Shield,
  Phone,
  Calendar,
  Zap,
  ArrowRight,
  Building2,
  Scale,
  Heart,
  Hammer,
  Car,
  Scissors,
  Dumbbell,
  UtensilsCrossed,
  DollarSign,
  Home,
  Star,
  AlertTriangle,
} from 'lucide-react';

// ─── Industry Data ─────────────────────────────────────────────────────────────
const INDUSTRY_DATA: Record<
  string,
  {
    tagline: string;
    pages: string[];
    recommendedAddons: string[];
    color: string;
  }
> = {
  'Insurance Agent': {
    tagline:
      'Perfect for independent agents and agencies needing to capture more quote requests online.',
    pages: ['Home', 'Services / Coverage Types', 'About the Agent', 'FAQ', 'Contact', 'Get a Quote'],
    recommendedAddons: ['Smart Contact Forms', 'Cal.com Booking', 'Privacy Policy', 'AI Chatbot'],
    color: 'blue',
  },
  'Real Estate Agent': {
    tagline:
      'Built for agents who need to showcase listings, build trust, and book more showings.',
    pages: ['Home', 'Featured Listings', 'About', 'Testimonials', 'Contact', 'Book a Showing'],
    recommendedAddons: ['Cal.com Booking', 'AI Phone Receptionist', 'Chat Widget', 'Blog Automation'],
    color: 'emerald',
  },
  'Law Firm / Attorney': {
    tagline:
      'Designed for attorneys who need to project authority and capture qualified consultations.',
    pages: ['Home', 'Practice Areas', 'About the Firm', 'Team', 'FAQ', 'Contact'],
    recommendedAddons: ['Smart Contact Forms', 'Privacy Policy', 'Terms & Conditions', 'Cal.com Booking'],
    color: 'slate',
  },
  'Medical / Healthcare Provider': {
    tagline:
      'For doctors, dentists, and specialists who need to fill their appointment calendar.',
    pages: ['Home', 'Services', 'About the Practice', 'Team', 'Patient Info / FAQ', 'Contact'],
    recommendedAddons: ['Cal.com Booking', 'Smart Contact Forms', 'Privacy Policy', 'AI Chatbot'],
    color: 'teal',
  },
  'Med Spa & Aesthetics': {
    tagline:
      'For aesthetic providers who want a luxury online presence that converts browsers to bookings.',
    pages: ['Home', 'Treatments / Services', 'Gallery', 'About', 'Testimonials', 'Book Now'],
    recommendedAddons: ['Cal.com Booking', 'Chat Widget', 'Blog Automation', 'AI Chatbot'],
    color: 'pink',
  },
  'Financial Advisor': {
    tagline:
      'For advisors who need to establish credibility and generate qualified consultation requests.',
    pages: ['Home', 'Services', 'About', 'Resources / Blog', 'FAQ', 'Contact'],
    recommendedAddons: ['Smart Contact Forms', 'Cal.com Booking', 'Blog Automation', 'Privacy Policy'],
    color: 'indigo',
  },
  'General Contractor / Home Services': {
    tagline:
      'For contractors, plumbers, HVAC, and home service pros who need more local leads.',
    pages: ['Home', 'Services', 'Gallery / Past Work', 'About', 'Reviews', 'Get a Free Estimate'],
    recommendedAddons: ['Smart Contact Forms', 'AI Phone Receptionist', 'Chat Widget', 'Cal.com Booking'],
    color: 'orange',
  },
  'Restaurant & Food Service': {
    tagline:
      'For restaurants and caterers who need to showcase their menu and drive reservations.',
    pages: ['Home', 'Menu', 'About Us', 'Gallery', 'Events / Catering', 'Reserve a Table'],
    recommendedAddons: ['Smart Contact Forms', 'Cal.com Booking', 'Blog Automation', 'Chat Widget'],
    color: 'red',
  },
  'Fitness & Wellness': {
    tagline:
      'For trainers, gyms, and wellness coaches who want to fill their classes and client roster.',
    pages: ['Home', 'Programs / Classes', 'About the Coach', 'Testimonials', 'FAQ', 'Book a Session'],
    recommendedAddons: ['Cal.com Booking', 'Chat Widget', 'Blog Automation', 'AI Chatbot'],
    color: 'green',
  },
  'Auto Dealership / Services': {
    tagline:
      'For auto shops and dealers who need to capture service requests and build trust online.',
    pages: ['Home', 'Services', 'About', 'Gallery / Inventory', 'Reviews', 'Schedule Service'],
    recommendedAddons: ['Smart Contact Forms', 'AI Phone Receptionist', 'Cal.com Booking', 'Chat Widget'],
    color: 'slate',
  },
  'Salon & Beauty': {
    tagline:
      'For stylists, salons, and beauty professionals who want their work to speak for itself.',
    pages: ['Home', 'Services & Pricing', 'Gallery', 'About', 'Testimonials', 'Book Appointment'],
    recommendedAddons: ['Cal.com Booking', 'Chat Widget', 'Blog Automation', 'AI Chatbot'],
    color: 'purple',
  },
  'Other Professional Service': {
    tagline:
      'A professional, conversion-focused website built around your unique business.',
    pages: ['Home', 'Services', 'About', 'Testimonials', 'FAQ', 'Contact'],
    recommendedAddons: ['Smart Contact Forms', 'Cal.com Booking', 'Chat Widget', 'Blog Automation'],
    color: 'indigo',
  },
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string; btn: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700',    btn: 'bg-blue-600 hover:bg-blue-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200',   badge: 'bg-slate-100 text-slate-700',   btn: 'bg-slate-700 hover:bg-slate-800' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-700',    btn: 'bg-teal-600 hover:bg-teal-700' },
  pink:    { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    badge: 'bg-pink-100 text-pink-700',    btn: 'bg-pink-600 hover:bg-pink-700' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700',  btn: 'bg-indigo-600 hover:bg-indigo-700' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700',  btn: 'bg-orange-600 hover:bg-orange-700' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     badge: 'bg-red-100 text-red-700',     btn: 'bg-red-600 hover:bg-red-700' },
  green:   { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   badge: 'bg-green-100 text-green-700',   btn: 'bg-green-600 hover:bg-green-700' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700',  btn: 'bg-purple-600 hover:bg-purple-700' },
};

// ─── Industry Icons Row ────────────────────────────────────────────────────────
const INDUSTRY_ICONS = [
  { label: 'Insurance', icon: Shield },
  { label: 'Real Estate', icon: Home },
  { label: 'Legal', icon: Scale },
  { label: 'Medical', icon: Heart },
  { label: 'Contractor', icon: Hammer },
  { label: 'Restaurant', icon: UtensilsCrossed },
  { label: 'Finance', icon: DollarSign },
  { label: 'Auto', icon: Car },
  { label: 'Salon', icon: Scissors },
  { label: 'Fitness', icon: Dumbbell },
];

// ─── Setup Fee — What's Included ──────────────────────────────────────────────
const SETUP_INCLUDES = [
  'Custom AI-built website for your industry',
  'Professional design tailored to your brand',
  'All pages built & configured',
  'Mobile optimized & SEO ready',
  'Domain connection + SSL + Hosting setup',
  '7-day delivery guarantee',
];

// ─── Pricing Plans ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter',
    price: '$97',
    tier: 'starter',
    features: [
      'AI-Built Professional Website',
      'Up to 5 Pages',
      'Mobile Optimized',
      'Smart Contact Form',
      'SSL & Hosting Included',
      'Monthly Maintenance',
    ],
    included: [
      'AI Chat Agent — Included',
      'Cal.com Booking Calendar — Included',
    ],
    popular: false,
    color: 'slate',
  },
  {
    name: 'Growth',
    price: '$147',
    tier: 'growth',
    features: [
      'Everything in Starter, plus:',
      'AI Phone Receptionist — Inbound',
      'Live Chat Widget',
      'Automated Blog (2 posts/month)',
      'Privacy Policy + Terms Pages',
    ],
    included: [],
    popular: false,
    color: 'indigo',
  },
  {
    name: 'Pro',
    price: '$197',
    tier: 'pro',
    features: [
      'Everything in Growth, plus:',
      'AI Chatbot on Website (advanced)',
      'AI Phone — Inbound + Outbound',
      'Automated Blog (4 posts/month)',
      'Google Calendar Integration',
    ],
    included: [],
    popular: true,
    color: 'indigo',
  },
  {
    name: 'Elite',
    price: '$247',
    tier: 'elite',
    features: [
      'Everything in Pro, plus:',
      'Weekly Blog Posts (auto-published)',
      'Priority Support',
      'Quarterly Site Refresh',
    ],
    included: [],
    popular: false,
    color: 'slate',
  },
];

// ─── All Available Add-Ons (with pricing) ─────────────────────────────────────
const ADDONS = {
  oneTime: [
    {
      name: 'Form Leads Collector',
      description: 'Capture and collect leads from contact forms. All submissions delivered straight to your dashboard.',
      price: '$50',
      billing: 'one-time',
      icon: '📋',
    },
    {
      name: 'Events Leads Collector',
      description: 'Create event landing pages, promote your events, and collect leads and RSVPs — all in one place.',
      price: '$250',
      billing: 'one-time',
      icon: '🎟️',
    },
    {
      name: 'Stripe Payment Integration',
      description: 'Accept online payments through your website. Includes setup for up to 5 products or services.',
      price: '$250',
      billing: 'one-time',
      icon: '💳',
    },
    {
      name: 'Advanced SEO Optimization',
      description: 'Comprehensive on-page and technical SEO optimization to improve your rankings and drive organic traffic.',
      price: '$850',
      billing: 'one-time',
      icon: '🔍',
    },
  ],
  monthly: [
    {
      name: '24/7 AI Phone Receptionist',
      description: 'AI-powered receptionist that answers calls 24/7, responds to customer questions, and books appointments automatically.',
      price: '$1,500 setup + $50/mo',
      billing: 'setup + monthly',
      icon: '📞',
    },
    {
      name: 'AI Website Chat Assistant',
      description: 'AI-powered chat assistant trained on your business to answer FAQs, capture leads, and book appointments.',
      price: '$750 setup + $50/mo',
      billing: 'setup + monthly',
      icon: '💬',
    },
    {
      name: 'Missed Call Text-Back Automation',
      description: 'Automatically sends an instant text when a call is missed — recover lost leads instantly.',
      price: '$199 setup + $49/mo',
      billing: 'setup + monthly',
      icon: '📲',
    },
    {
      name: 'Automated SEO Blog System',
      description: 'Automatically generates and publishes SEO-optimized articles to increase search visibility and authority.',
      price: '$1,200 setup + $197/mo',
      billing: 'setup + monthly',
      icon: '✍️',
    },
    {
      name: 'Automated Email Marketing System',
      description: 'Pre-built automated email campaigns to nurture leads, follow up automatically, and drive repeat engagement.',
      price: '$750 setup + $97/mo',
      billing: 'setup + monthly',
      icon: '📧',
    },
    {
      name: 'Content Management & Updates',
      description: 'Blog posts, podcast uploads, event updates, and media management handled for you monthly.',
      price: '$250 setup + $50/mo',
      billing: 'setup + monthly',
      icon: '🖊️',
    },
    {
      name: 'Professional Business Email Setup',
      description: 'Custom domain email addresses (you@yourdomain.com) with security config. Includes up to 10 mailboxes.',
      price: '$149 setup + $29/mo',
      billing: 'setup + monthly',
      icon: '📨',
    },
  ],
};

// ─── Industries that need e-commerce / are not a Pro Sites fit ────────────────
const ECOMMERCE_INDUSTRIES = new Set([
  'Auto Dealership / Services',
]);

// ─── Main Component ────────────────────────────────────────────────────────────
const ProSitesPage: React.FC = () => {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');

  const industryData = selectedIndustry ? INDUSTRY_DATA[selectedIndustry] : null;
  const colors = industryData ? COLOR_MAP[industryData.color] || COLOR_MAP.indigo : COLOR_MAP.indigo;

  const scrollToPricing = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById('pricing');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-white">

      {/* ─── A. Hero Section ──────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 pt-32 pb-24 overflow-hidden">
        {/* Background grid decoration */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/10 blur-3xl rounded-full" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-full px-4 py-1.5 text-sm font-semibold mb-6 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Introducing CWP Pro Sites
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6">
            Professional Websites Built for Your Industry —{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              Ready in 7 Days
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Pay once, get a fully AI-built website tailored to your profession. Maintain it monthly for less than your daily coffee.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/pro-sites/checkout"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-full text-base transition-all shadow-lg shadow-indigo-900/40 active:scale-95 flex items-center justify-center gap-2"
            >
              Get Started — $497 Setup
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#pricing"
              onClick={scrollToPricing}
              className="border border-slate-600 hover:border-indigo-400 text-slate-300 hover:text-white font-semibold px-8 py-4 rounded-full text-base transition-all backdrop-blur-sm"
            >
              See What's Included
            </a>
          </div>

          {/* Industry Icons Row */}
          <div className="flex flex-wrap justify-center gap-3">
            {INDUSTRY_ICONS.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-slate-300 text-xs font-medium"
              >
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── B. Industry Selector Section ────────────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              Built Specifically For Your Industry
            </h2>
            <p className="text-slate-500 text-lg">
              Select your industry to see exactly what you get.
            </p>
          </div>

          {/* Dropdown */}
          <div className="relative max-w-xl mx-auto mb-10">
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full appearance-none bg-white border-2 border-slate-200 hover:border-indigo-400 focus:border-indigo-600 rounded-2xl px-6 py-4 pr-12 text-slate-800 font-semibold text-base shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all cursor-pointer"
            >
              <option value="">— Select your industry —</option>
              {Object.keys(INDUSTRY_DATA).map((industry) => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>

          {/* Industry Detail Card */}
          {industryData && (
            <div className={`rounded-3xl border-2 ${colors.border} ${colors.bg} p-8 shadow-sm transition-all`}>
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-1">
                  <h3 className={`text-2xl font-extrabold mb-2 ${colors.text}`}>{selectedIndustry}</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">{industryData.tagline}</p>
                  {ECOMMERCE_INDUSTRIES.has(selectedIndustry) && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-amber-800 text-sm">
                        <strong>Heads up:</strong> This industry often requires e-commerce or inventory management features. Pro Sites handles lead generation and service-based websites — not e-stores. We can still help, just through a different path.
                      </p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Pages */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
                        Pages Included
                      </h4>
                      <ul className="space-y-2">
                        {industryData.pages.map((page) => (
                          <li key={page} className="flex items-center gap-2 text-slate-700 text-sm font-medium">
                            <CheckCircle2 className={`w-4 h-4 shrink-0 ${colors.text}`} />
                            {page}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommended Add-ons */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
                        Recommended Add-Ons
                      </h4>
                      <ul className="space-y-2">
                        {industryData.recommendedAddons.map((addon) => (
                          <li key={addon} className="flex items-center gap-2 text-slate-700 text-sm font-medium">
                            <Star className={`w-4 h-4 shrink-0 ${colors.text}`} />
                            {addon}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* CTA — or e-commerce notice */}
                <div className="md:w-56 shrink-0">
                  {ECOMMERCE_INDUSTRIES.has(selectedIndustry) ? (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
                      <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                      <p className="text-amber-900 font-bold text-sm mb-1">Not a Pro Sites Fit</p>
                      <p className="text-amber-700 text-xs mb-3 leading-relaxed">
                        This type of business typically needs an e-store or inventory system — that's not what Pro Sites is built for.
                      </p>
                      <Link
                        to="/onboarding"
                        className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-3 rounded-xl text-xs transition-all active:scale-95"
                      >
                        Explore Your Options
                        <span className="block font-normal mt-0.5 opacity-90">Start with our Onboarding Gem →</span>
                      </Link>
                    </div>
                  ) : (
                    <Link
                      to="/pro-sites/checkout?tier=starter"
                      className={`block w-full text-center text-white font-bold px-6 py-4 rounded-2xl text-sm transition-all shadow-md active:scale-95 ${colors.btn}`}
                    >
                      Get This Website
                      <span className="block text-xs font-normal mt-0.5 opacity-80">$497 Setup</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Placeholder when nothing selected */}
          {!selectedIndustry && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Select an industry above to see your custom site details</p>
            </div>
          )}
        </div>
      </section>

      {/* ─── C. How It Works Section ─────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-slate-500 text-lg">Three simple steps to your professional web presence.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: DollarSign,
                title: 'Pay the $497 Setup Fee',
                description:
                  'Fill out a quick form with your business info. We handle everything else.',
                color: 'indigo',
              },
              {
                step: '02',
                icon: Clock,
                title: 'We Build Your Site in 7 Days',
                description:
                  'Our AI generates your site, we configure all your add-ons and make sure everything works.',
                color: 'indigo',
              },
              {
                step: '03',
                icon: Globe,
                title: 'Your Site Goes Live',
                description:
                  'You get a notification, review it, and we publish. You\'re live with a professional web presence.',
                color: 'indigo',
              },
            ].map(({ step, icon: Icon, title, description }) => (
              <div
                key={step}
                className="relative bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-md transition-shadow"
              >
                <div className="text-6xl font-black text-slate-100 absolute top-6 right-6 leading-none select-none">
                  {step}
                </div>
                <div className="bg-indigo-600 text-white rounded-2xl p-3 w-fit mb-5">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── D. Pricing Tiers Section ────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">

          {/* Section heading */}
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Every plan starts with a one-time $497 setup. Then choose the monthly plan that fits — each one comes with featured add-ons pre-configured. Or customize your build with any add-on below.
            </p>
          </div>

          {/* $497 Setup — What's Included Banner */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-8 mb-10 border border-indigo-700/40 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-xl p-2">
                    <Zap className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">One-Time Setup Fee</p>
                    <p className="text-white text-3xl font-black leading-none">$497</p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-5 leading-relaxed">
                  Your setup fee covers everything needed to build and launch your professional website. Here's exactly what's included:
                </p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {SETUP_INCLUDES.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-200 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:w-64 shrink-0 bg-white/10 rounded-2xl p-5 border border-white/10 backdrop-blur-sm">
                <p className="text-white font-bold text-sm mb-3">After setup, choose your plan:</p>
                <ul className="space-y-2 mb-4">
                  <li className="flex justify-between text-sm text-slate-300"><span>Starter</span><span className="font-bold text-white">$97/mo</span></li>
                  <li className="flex justify-between text-sm text-slate-300"><span>Growth</span><span className="font-bold text-white">$147/mo</span></li>
                  <li className="flex justify-between text-sm text-slate-300"><span>Pro</span><span className="font-bold text-indigo-300">$197/mo ⭐</span></li>
                  <li className="flex justify-between text-sm text-slate-300"><span>Elite</span><span className="font-bold text-white">$247/mo</span></li>
                </ul>
                <Link
                  to="/pro-sites/checkout"
                  className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-95"
                >
                  Get Started — $497
                </Link>
              </div>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-3xl border-2 p-7 flex flex-col transition-all hover:shadow-xl ${
                  plan.popular
                    ? 'border-indigo-600 shadow-lg shadow-indigo-100 ring-2 ring-indigo-600/10 scale-[1.02]'
                    : 'border-slate-100 hover:border-indigo-200'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md whitespace-nowrap">
                      ⭐ Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-slate-400 text-sm mb-1.5">/mo</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">After $497 one-time setup</p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                      {feature.endsWith(':') ? (
                        <span className="font-semibold text-slate-700 text-xs uppercase tracking-wide w-full mt-1">
                          {feature}
                        </span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          {feature}
                        </>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Included featured add-ons */}
                {plan.included.length > 0 && (
                  <div className="border-t border-indigo-100 pt-3 mb-4">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2">Featured Add-Ons Included</p>
                    <ul className="space-y-1.5">
                      {plan.included.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-xs text-indigo-700 font-medium">
                          <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Link
                  to={`/pro-sites/checkout?tier=${plan.tier}`}
                  className={`block w-full text-center font-bold py-3 rounded-2xl text-sm transition-all active:scale-95 ${
                    plan.popular
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
                      : 'bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>

          {/* Customize note */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 text-center max-w-3xl mx-auto">
            <p className="text-amber-800 font-medium text-sm leading-relaxed">
              💡 <strong>Want to customize your build?</strong> Any add-on below can be added to any plan.{' '}
              <Link to="/contact" className="underline underline-offset-2 font-bold hover:text-amber-900">
                Contact us to build your perfect combination.
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ─── E. Add-Ons Section ───────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              Customize Any Plan With Add-Ons
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Every tier supports additional features. Mix and match what your business needs.
            </p>
          </div>

          {/* One-Time Add-Ons */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-widest rounded-full">One-Time</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {ADDONS.oneTime.map(({ icon, name, description, price }) => (
                <div
                  key={name}
                  className="bg-slate-50 border border-slate-100 rounded-2xl p-6 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 mb-1 text-sm">{name}</h3>
                      <p className="text-slate-500 text-sm mb-3 leading-relaxed">{description}</p>
                      <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full px-3 py-1">
                        {price}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Add-Ons */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-widest rounded-full">Setup + Monthly</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {ADDONS.monthly.map(({ icon, name, description, price }) => (
                <div
                  key={name}
                  className="bg-slate-50 border border-slate-100 rounded-2xl p-6 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 mb-1 text-sm">{name}</h3>
                      <p className="text-slate-500 text-sm mb-3 leading-relaxed">{description}</p>
                      <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full px-3 py-1">
                        {price}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── F. Final CTA Section ────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-full px-4 py-1.5 text-sm font-semibold mb-6 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Ready to Go Live?
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
            Ready to Get Your Professional Website?
          </h2>
          <p className="text-slate-300 text-lg mb-10 leading-relaxed">
            Join professionals across Georgia who trust CWP Pro Sites to run their online presence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/pro-sites/checkout"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-full text-base transition-all shadow-lg shadow-indigo-900/40 active:scale-95 flex items-center justify-center gap-2"
            >
              Get Started — $497 Setup
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="tel:4702646256"
              className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-8 py-4 rounded-full text-base transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              <Phone className="w-4 h-4" />
              Have Questions? Call Us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProSitesPage;
