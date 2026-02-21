// Types for the AI-generated multi-page website builder system

export interface WebsiteGlobal {
  business_name: string;
  phone: string;
  address: string;
  primary_color: string;
  font_heading: string;
  font_body: string;
  logo_url?: string;
  hero_image_url?: string;
}

export interface WebsiteSeo {
  title: string;
  meta_description: string;
  keywords: string[];
}

export interface WebsiteSection {
  section_type: SectionType;
  variant: string;
  content: Record<string, any>;
  editable_fields: string[];
}

export interface WebsitePage {
  id: PageId;
  name: string;
  slug: string; // '' for home, 'about' for about, etc.
  seo: WebsiteSeo;
  sections: WebsiteSection[];
}

export interface WebsiteJson {
  global: WebsiteGlobal;
  pages: WebsitePage[];
}

export type PageId =
  | 'home'
  | 'about'
  | 'services'
  | 'contact'
  | 'gallery'
  | 'faq'
  | 'testimonials'
  | 'pricing'
  | 'blog';

export type SectionType =
  | 'hero'
  | 'services'
  | 'about'
  | 'social_proof'
  | 'contact_cta'
  | 'contact_form'
  | 'faq'
  | 'stats'
  | 'gallery'
  | 'pricing_cards'
  | 'blog_preview';

export type GenerationStatus = 'draft' | 'generating' | 'complete' | 'error';

export interface WebsiteBrief {
  id: string;
  client_id: string;
  business_name: string;
  industry: string;
  services_offered: string;
  location: string;
  tone: 'Professional' | 'Friendly' | 'Bold' | 'Luxurious';
  art_direction: string | null;
  primary_color: string;
  generation_status: GenerationStatus;
  generation_error: string | null;
  website_json: WebsiteJson | null;
  client_slug: string | null;
  custom_domain: string | null;
  is_published: boolean;
  premium_features: PremiumFeatureId[];
  created_at: string;
  updated_at: string;
}

export interface SectionComponentProps {
  content: Record<string, any>;
  global: WebsiteGlobal;
}

export interface WebsiteEdit {
  field_path: string;
  new_value: string;
}

// Page metadata for the builder UI
export interface PageOption {
  id: PageId;
  name: string;
  slug: string;
  description: string;
  locked?: boolean;
}

export const ALL_PAGE_OPTIONS: PageOption[] = [
  { id: 'home',         name: 'Home',         slug: '',            description: 'Hero, services overview, CTA', locked: true },
  { id: 'about',        name: 'About Us',      slug: 'about',       description: 'Story, team, stats' },
  { id: 'services',     name: 'Services',      slug: 'services',    description: 'Full services detail & FAQ' },
  { id: 'contact',      name: 'Contact Us',    slug: 'contact',     description: 'Form, phone, hours, map' },
  { id: 'gallery',      name: 'Gallery',       slug: 'gallery',     description: 'Photo & project portfolio' },
  { id: 'faq',          name: 'FAQ',           slug: 'faq',         description: 'Comprehensive Q&A page' },
  { id: 'testimonials', name: 'Testimonials',  slug: 'testimonials',description: 'Reviews & social proof' },
  { id: 'pricing',      name: 'Pricing',       slug: 'pricing',     description: 'Packages & tier cards' },
  { id: 'blog',         name: 'Blog',          slug: 'blog',        description: 'AI-generated articles (premium)' },
];

// ─── Premium Features ─────────────────────────────────────────────────────────

export type PremiumFeatureId =
  // Calendar
  | 'cal_com'
  | 'google_calendar'
  // AI Phone
  | 'ai_phone_inbound'
  | 'ai_phone_outbound'
  // Forms
  | 'contact_forms'
  // Legal pages
  | 'legal_privacy_policy'
  | 'legal_terms_conditions'
  | 'legal_refund_policy'
  // AI functionality
  | 'ai_content_generation'
  | 'ai_assistant'
  // Widgets & chatbots
  | 'chat_widget'
  | 'ai_chatbot'
  // Blog
  | 'blog'
  // Client Portal
  | 'client_back_office';

export interface PremiumFeatureOption {
  id: PremiumFeatureId;
  name: string;
  description: string;
  group: PremiumFeatureGroup;
  badge?: string; // e.g. 'Recommended'
}

export type PremiumFeatureGroup =
  | 'Calendar'
  | 'AI Phone Receptionist'
  | 'Forms'
  | 'Legal Pages'
  | 'AI Functionality'
  | 'Widgets & Chatbots'
  | 'Client Portal';

export const PREMIUM_FEATURE_OPTIONS: PremiumFeatureOption[] = [
  // Calendar
  {
    id: 'cal_com',
    name: 'Cal.com Booking',
    description: 'Embed a Cal.com booking calendar — clients schedule appointments directly on the site',
    group: 'Calendar',
    badge: 'Recommended',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Connect Google Calendar for availability display and appointment sync',
    group: 'Calendar',
  },

  // AI Phone
  {
    id: 'ai_phone_inbound',
    name: 'AI Receptionist — Inbound',
    description: 'AI answers inbound calls 24/7, qualifies leads, books appointments, and takes messages',
    group: 'AI Phone Receptionist',
    badge: 'Popular',
  },
  {
    id: 'ai_phone_outbound',
    name: 'AI Receptionist — Outbound',
    description: 'AI makes outbound follow-up calls to leads, confirms appointments, and re-engages past clients',
    group: 'AI Phone Receptionist',
  },

  // Forms
  {
    id: 'contact_forms',
    name: 'Smart Contact Forms',
    description: 'Conversion-optimised contact & lead capture forms with spam protection and CRM routing',
    group: 'Forms',
  },

  // Legal Pages
  {
    id: 'legal_privacy_policy',
    name: 'Privacy Policy',
    description: 'AI-generated, business-specific privacy policy page — GDPR & CCPA aware',
    group: 'Legal Pages',
  },
  {
    id: 'legal_terms_conditions',
    name: 'Terms & Conditions',
    description: 'AI-generated terms of service tailored to the client\'s industry and services',
    group: 'Legal Pages',
  },
  {
    id: 'legal_refund_policy',
    name: 'Refund Policy',
    description: 'AI-generated refund & cancellation policy page for the client\'s business model',
    group: 'Legal Pages',
  },

  // AI Functionality
  {
    id: 'ai_content_generation',
    name: 'AI Content Generation',
    description: 'Let clients regenerate page copy, blog posts, and marketing content with one click',
    group: 'AI Functionality',
  },
  {
    id: 'ai_assistant',
    name: 'AI Business Assistant',
    description: 'Embedded AI assistant for the client dashboard — answers business questions and drafts emails',
    group: 'AI Functionality',
  },

  // Widgets & Chatbots
  {
    id: 'chat_widget',
    name: 'Live Chat Widget',
    description: 'Real-time chat widget so website visitors can message the business instantly',
    group: 'Widgets & Chatbots',
  },
  {
    id: 'ai_chatbot',
    name: 'AI Chatbot',
    description: 'AI-powered chatbot trained on the client\'s business info — handles FAQs and captures leads automatically',
    group: 'Widgets & Chatbots',
    badge: 'Popular',
  },

  // Client Portal
  {
    id: 'client_back_office',
    name: 'Client Back Office',
    description: 'Private /back-office login on the client\'s own domain — edit site content and view form submissions without touching the main CWP portal',
    group: 'Client Portal',
    badge: 'Recommended',
  },
];

export const PREMIUM_FEATURE_GROUPS: PremiumFeatureGroup[] = [
  'Calendar',
  'AI Phone Receptionist',
  'Forms',
  'Legal Pages',
  'AI Functionality',
  'Widgets & Chatbots',
  'Client Portal',
];
