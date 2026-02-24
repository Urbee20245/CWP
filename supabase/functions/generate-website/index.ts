export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set.');

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function makeUniqueSlug(db: any, base: string, excludeId?: string): Promise<string> {
  const s = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? s : s + '-' + attempt;
    const { data } = await db.from('website_briefs').select('client_id').eq('client_slug', candidate);
    if (!(data || []).find((r: any) => r.client_id !== excludeId)) return candidate;
    attempt++;
  }
}

const PAGE_GUIDE: Record<string, string> = {
  home: 'hero(1), services(1), stats(1), social_proof(1), contact_cta(1)',
  about: 'about(1), stats(1), social_proof(1), contact_cta(1)',
  services: 'hero(1), services(accordion variant), faq(1), contact_cta(1)',
  contact: 'contact_cta(split_contact variant), faq(1)',
  gallery: 'gallery(masonry_grid), contact_cta(1)',
  faq: 'faq(8-12 questions), contact_cta(1)',
  testimonials: 'social_proof(review_wall, 4-6 reviews), stats(1), contact_cta(1)',
  pricing: 'pricing_cards(1), faq(1), contact_cta(1)',
  blog: 'blog_preview(1), contact_cta(1)',
  portfolio: 'hero(1), gallery(masonry_grid), services(1), contact_cta(1)',
  menu: 'hero(1), menu_section(1), contact_cta(1)',
  team: 'hero(1), team(1), stats(1), contact_cta(1)',
};

const PAGE_NAMES: Record<string, string> = {
  home: 'Home', about: 'About Us', services: 'Services', contact: 'Contact Us',
  gallery: 'Gallery', faq: 'FAQ', testimonials: 'Testimonials', pricing: 'Pricing',
  blog: 'Blog', portfolio: 'Portfolio', menu: 'Menu', team: 'Our Team',
};

const PAGE_SLUGS: Record<string, string> = {
  home: '', about: 'about', services: 'services', contact: 'contact',
  gallery: 'gallery', faq: 'faq', testimonials: 'testimonials', pricing: 'pricing',
  blog: 'blog', portfolio: 'portfolio', menu: 'menu', team: 'team',
};

const SYSTEM_INSTRUCTION = `You are an expert web designer and copywriter. Design a complete MULTI-PAGE website.
RETURN ONLY valid JSON - no markdown, no code fences, nothing else.

Schema:
{
  "global": { "business_name": string, "phone": string, "address": string, "primary_color": string,
    "font_heading": "Inter"|"Playfair Display"|"Montserrat"|"Raleway",
    "font_body": "Inter"|"Lato"|"Open Sans", "logo_url": "", "hero_image_url": "" },
  "pages": [{ "id": string, "name": string, "slug": string,
    "seo": { "title": string, "meta_description": string, "keywords": string[] },
    "sections": [{ "section_type": string, "variant": string, "content": object, "editable_fields": string[] }]
  }]
}

SECTION TYPES + VARIANTS:
hero: centered_cta | split_image_left | bold_statement | minimal_text
services: three_column_cards | icon_list | accordion | two_column_detailed
about: left_text_right_stats | centered_story | founder_focus | mission_values
social_proof: star_testimonials | review_wall | stats_bar
contact_cta: simple_form | phone_prominent | split_contact | minimal_cta
faq: accordion_simple | two_column
stats: four_number_bar | icon_stats
gallery: masonry_grid | simple_grid
pricing_cards: three_tier | two_tier | custom_quote
blog_preview: card_grid | featured_post
team: card_grid | founder_spotlight
menu_section: categorized_menu | two_column
process: numbered_steps | timeline | icon_cards
features: icon_grid | alternating_blocks

CONTENT FIELDS:
hero: {headline, subheadline, cta_primary_text, cta_primary_link, background_style:"gradient"|"dark"|"light"}
services: {heading, subtext, services:[{name, description, icon}]} 3-8 items
about: {heading, body, stat_1_number, stat_1_label, stat_2_number, stat_2_label}
social_proof: {heading, reviews:[{author, stars, text}]} 2-6 items
contact_cta: {heading, subtext, phone, email, hours}
faq: {heading, faqs:[{question, answer}]}
stats: {stats:[{number, label}]} 3-4 items
gallery: {heading, subtext}
pricing_cards: {heading, subtext, tiers:[{name, price, period, description, features:string[], cta_text, highlighted:boolean}]}
blog_preview: {heading, subtext}
team: {heading, subtext, members:[{name, role, bio, image_placeholder:"initials"}]}
menu_section: {heading, categories:[{name, items:[{name, description, price}]}]}
process: {heading, subtext, steps:[{number, title, description}]}
features: {heading, subtext, features:[{title, description, icon}]}

All copy must be specific to this exact business. SEO title max 60 chars. Return ONLY JSON.`;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { client_id, business_name, industry, services_offered, location, tone, primary_color, art_direction, pages_to_generate } = body;

    if (!client_id || !business_name || !industry || !services_offered || !location || !tone) {
      return errorResponse('Missing required brief fields.', 400);
    }

    const pages: string[] = Array.isArray(pages_to_generate) && pages_to_generate.length
      ? pages_to_generate : ['home', 'about', 'services', 'contact'];
    if (!pages.includes('home')) pages.unshift('home');

    console.log('[generate-website] Starting for client_id=' + client_id + ' pages=' + pages.join(','));

    // Get existing record to preserve legacy slug
    const { data: existing } = await db.from('website_briefs').select('client_slug, slug').eq('client_id', client_id).maybeSingle();
    const client_slug = await makeUniqueSlug(db, existing?.client_slug || slugify(business_name), client_id);
    const legacySlug = existing?.slug || client_slug;

    // Upsert - slug is now nullable after migration so this will succeed
    const { error: upsertError } = await db.from('website_briefs').upsert({
      client_id, slug: legacySlug, client_slug, business_name, industry, services_offered, location, tone,
      primary_color: primary_color || '#4F46E5', art_direction: art_direction || null,
      generation_status: 'generating', generation_error: null,
    }, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('[generate-website] Upsert failed: ' + upsertError.message);
      return errorResponse('Failed to create website record: ' + upsertError.message, 500);
    }

    const pagesGuide = pages.map(function(p) {
      return 'PAGE "' + p + '" name="' + (PAGE_NAMES[p] || p) + '" slug="' + (PAGE_SLUGS[p] || p) + '":\n  ' + (PAGE_GUIDE[p] || 'hero(1), about(1), contact_cta(1)');
    }).join('\n\n');

    const userPrompt = 'Design a website for:\n\nBusiness: ' + business_name + '\nIndustry: ' + industry + '\nServices: ' + services_offered + '\nLocation: ' + location + '\nTone: ' + tone + '\nColor: ' + (primary_color || '#4F46E5') + '\nNotes: ' + (art_direction || 'Use best judgment for this business type') + '\n\nPAGES:\n' + pagesGuide + '\n\nReturn complete JSON now.';

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.75,
        maxOutputTokens: 32768,
        responseMimeType: 'application/json',
      },
    });

    const rawText = (response.text || '').trim();
    let websiteJson: any;

    try {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      websiteJson = JSON.parse(cleaned);
    } catch (_e) {
      console.error('[generate-website] JSON parse failed. Raw:', rawText.slice(0, 400));
      await db.from('website_briefs').update({ generation_status: 'error', generation_error: 'AI returned invalid JSON.' }).eq('client_id', client_id);
      return errorResponse('AI returned invalid JSON. Please try again.', 500);
    }

    if (!websiteJson.global || !Array.isArray(websiteJson.pages) || !websiteJson.pages.length) {
      await db.from('website_briefs').update({ generation_status: 'error', generation_error: 'AI response missing required fields.' }).eq('client_id', client_id);
      return errorResponse('AI response missing required fields.', 500);
    }

    websiteJson.global.phone = websiteJson.global.phone || '';
    websiteJson.global.address = websiteJson.global.address || location;
    websiteJson.global.primary_color = primary_color || websiteJson.global.primary_color || '#4F46E5';
    websiteJson.global.logo_url = '';
    websiteJson.global.hero_image_url = '';

    for (const page of websiteJson.pages) {
      page.sections = page.sections || [];
      if (!page.seo) page.seo = { title: business_name + ' - ' + page.name, meta_description: '', keywords: [] };
    }

    const { error: saveError } = await db.from('website_briefs').update({
      website_json: websiteJson, client_slug, generation_status: 'complete', generation_error: null,
    }).eq('client_id', client_id);

    if (saveError) {
      console.error('[generate-website] Save failed: ' + saveError.message);
      return errorResponse('Failed to save website: ' + saveError.message, 500);
    }

    console.log('[generate-website] SUCCESS slug=' + client_slug + ' pages=' + websiteJson.pages.length);
    return jsonResponse({ success: true, client_slug, website_json: websiteJson });

  } catch (error: any) {
    console.error('[generate-website] Error: ' + error.message);
    try {
      const b = await req.clone().json().catch(function() { return {}; });
      if (b && b.client_id) {
        await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).from('website_briefs')
          .update({ generation_status: 'error', generation_error: error.message })
          .eq('client_id', b.client_id);
      }
    } catch (_e2) { /* ignore */ }
    return errorResponse(error.message, 500);
  }
});

