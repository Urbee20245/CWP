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
  is_published: boolean;
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
