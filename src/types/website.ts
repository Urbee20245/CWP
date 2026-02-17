// Types for the AI-generated website builder system

export interface WebsiteGlobal {
  business_name: string;
  phone: string;
  address: string;
  primary_color: string;
  font_heading: string;
  font_body: string;
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

export interface WebsiteJson {
  global: WebsiteGlobal;
  seo: WebsiteSeo;
  page_structure: WebsiteSection[];
}

export type SectionType =
  | 'hero'
  | 'services'
  | 'about'
  | 'social_proof'
  | 'contact_cta'
  | 'faq'
  | 'stats'
  | 'gallery';

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
