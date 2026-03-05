export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import {
  generateWithProvider,
  AI_PROVIDERS,
  DEFAULT_PROVIDER_ID,
} from '../_shared/ai-providers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
  home:         'hero(1), services(1), stats(1), social_proof(1), contact_cta(1)',
  about:        'about(1), stats(1), social_proof(1), contact_cta(1)',
  services:     'hero(1), services(accordion variant), faq(1), contact_cta(1)',
  contact:      'contact_cta(split_contact variant), faq(1)',
  gallery:      'gallery(masonry_grid), contact_cta(1)',
  faq:          'faq(8-12 questions), contact_cta(1)',
  testimonials: 'social_proof(review_wall, 4-6 reviews), stats(1), contact_cta(1)',
  pricing:      'pricing_cards(1), faq(1), contact_cta(1)',
  blog:         'blog_preview(1), contact_cta(1)',
  portfolio:    'hero(1), gallery(masonry_grid), services(1), contact_cta(1)',
  menu:         'hero(1), menu_section(1), contact_cta(1)',
  team:         'hero(1), team(1), stats(1), contact_cta(1)',
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

const SYSTEM_INSTRUCTION = `You are an elite web designer building stunning, unique websites.
RETURN ONLY valid JSON — no markdown, no code fences, nothing else.

CRITICAL: Every website must look COMPLETELY DIFFERENT. Vary layouts, colors, fonts, spacing.
Never produce the same design twice. Be bold, creative, specific to the business.

Schema:
{
  "global": {
    "business_name": string,
    "phone": string,
    "address": string,
    "primary_color": string,        // Specific hex — not generic purple. Match industry mood.
    "secondary_color": string,      // Complementary accent color
    "background_color": string,     // Page background (white, off-white, dark, etc)
    "text_color": string,           // Main text color
    "font_heading": "Playfair Display"|"Montserrat"|"Raleway"|"Inter"|"Oswald"|"Merriweather",
    "font_body": "Inter"|"Lato"|"Open Sans"|"Georgia",
    "logo_url": "",
    "hero_image_url": ""
  },
  "pages": [{
    "id": string,
    "name": string,
    "slug": string,
    "seo": { "title": string, "meta_description": string, "keywords": string[] },
    "sections": [{
      "section_type": string,
      "variant": string,
      "content": object,
      "style_overrides": {
        "background": string,
        "text_color": string,
        "padding": string
      },
      "editable_fields": string[]
    }]
  }]
}

SECTION TYPES — use all of them creatively:
hero: centered_cta | split_image_left | split_image_right | bold_statement | minimal_text | video_background | fullscreen
services: three_column_cards | icon_list | accordion | two_column_detailed | horizontal_scroll | numbered_list
about: left_text_right_stats | centered_story | founder_focus | mission_values | timeline | split_image
social_proof: star_testimonials | review_wall | stats_bar | logo_strip | quote_highlight | video_testimonial
contact_cta: simple_form | phone_prominent | split_contact | minimal_cta | full_width_cta | floating_card
faq: accordion_simple | two_column | tabbed | searchable
stats: four_number_bar | icon_stats | large_numbers | animated_counters
gallery: masonry_grid | simple_grid | carousel | polaroid | before_after
pricing_cards: three_tier | two_tier | custom_quote | comparison_table | toggle_annual_monthly
blog_preview: card_grid | featured_post | magazine_layout
team: card_grid | founder_spotlight | horizontal_scroll | minimal_list
process: numbered_steps | timeline | icon_cards | horizontal_flow | circular
features: icon_grid | alternating_blocks | checklist | split_highlight
newsletter: minimal | full_width | popup_trigger
awards: logo_wall | card_grid | timeline

CONTENT — be SPECIFIC and RICH:
hero: {
  headline: string (powerful, specific — NOT generic),
  subheadline: string (specific value prop),
  cta_primary_text: string,
  cta_primary_link: string,
  cta_secondary_text: string,
  cta_secondary_link: string,
  background_style: "gradient"|"dark"|"light"|"image"|"video",
  background_image_url: "",
  background_gradient: string,
  badge_text: string,
  trust_badges: string[]
}
services: {heading, subtext, services:[{name, description, icon, price?, highlight?:boolean}]}
about: {heading, body, image_url:"", stat_1_number, stat_1_label, stat_2_number, stat_2_label, stat_3_number?, stat_3_label?}
social_proof: {heading, reviews:[{author, role?, stars, text, avatar_initials}], show_rating_summary?:boolean}
contact_cta: {heading, subtext, phone, email, hours, address, map_embed_url?, form_fields?:string[]}
faq: {heading, faqs:[{question, answer}]} — minimum 6 FAQs
stats: {stats:[{number, label, icon?, prefix?, suffix?}]}
gallery: {heading, subtext, images:[{url:"", caption}]}
pricing_cards: {heading, subtext, tiers:[{name, price, period, description, features:string[], cta_text, highlighted:boolean, badge?:string}]}
team: {heading, subtext, members:[{name, role, bio, image_url:"", linkedin_url?}]}
process: {heading, subtext, steps:[{number, title, description, icon?}]}
features: {heading, subtext, features:[{title, description, icon, highlight?:boolean}]}
newsletter: {heading, subtext, button_text, placeholder_text}
blog_preview: {heading, subtext}
menu_section: {heading, categories:[{name, items:[{name, description, price}]}]}

DESIGN RULES:
1. Financial/wealth: dark navy + gold. Serif fonts. Luxury feel. (#0a1628 + #c9a84c)
2. Medical/health: clean white + teal/green. Sans-serif. Trust-focused.
3. Restaurant/food: warm colors + dark backgrounds. Bold fonts. Appetite appeal.
4. Church/nonprofit: warm cream + burgundy/navy. Welcoming, community-focused.
5. Tech/SaaS: dark mode OR ultra-minimal white. Monospace accents. Geometric.
6. Beauty/salon: blush pink OR deep purple. Elegant serif. Feminine luxury.
7. Legal: navy + gold. Traditional. Authoritative. Conservative layout.
8. Real estate: white + charcoal + accent. Photography-forward.
9. Fitness: dark + neon accents. Bold. Energetic. Action-oriented.
10. Education: bright, approachable. Blues and greens. Friendly typography.

QUALITY BAR: Every site must look like it was designed by a $10,000 web designer.
Be opinionated. Make SPECIFIC color choices. Write SPECIFIC copy. Use ALL sections.
Return ONLY the JSON object.`;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const {
      client_id, business_name, industry, services_offered, location, tone,
      primary_color, art_direction, pages_to_generate,
      ai_provider = DEFAULT_PROVIDER_ID,
    } = body;

    if (!client_id || !business_name || !industry || !services_offered || !location || !tone) {
      return errorResponse('Missing required brief fields.', 400);
    }

    // Resolve provider config
    const providerConfig = AI_PROVIDERS[ai_provider] || AI_PROVIDERS[DEFAULT_PROVIDER_ID];
    const resolvedProviderId = providerConfig.id;

    const pages: string[] = Array.isArray(pages_to_generate) && pages_to_generate.length
      ? pages_to_generate : ['home', 'about', 'services', 'contact'];
    if (!pages.includes('home')) pages.unshift('home');

    console.log(`[generate-website] client_id=${client_id} pages=${pages.join(',')} provider=${resolvedProviderId} model=${providerConfig.model}`);

    // Get existing record to preserve legacy slug
    const { data: existing } = await db.from('website_briefs').select('client_slug, slug').eq('client_id', client_id).maybeSingle();
    const client_slug = await makeUniqueSlug(db, existing?.client_slug || slugify(business_name), client_id);
    const legacySlug = existing?.slug || client_slug;

    // Upsert - mark as generating
    const { error: upsertError } = await db.from('website_briefs').upsert({
      client_id, slug: legacySlug, client_slug, business_name, industry, services_offered, location, tone,
      primary_color: primary_color || null, art_direction: art_direction || null,
      generation_status: 'generating', generation_error: null,
    }, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('[generate-website] Upsert failed: ' + upsertError.message);
      return errorResponse('Failed to create website record: ' + upsertError.message, 500);
    }

    const pagesGuide = pages.map(p =>
      `PAGE "${p}" name="${PAGE_NAMES[p] || p}" slug="${PAGE_SLUGS[p] || p}":\n  ${PAGE_GUIDE[p] || 'hero(1), about(1), contact_cta(1)'}`
    ).join('\n\n');

    const userPrompt = `Design a website for:

Business: ${business_name}
Industry: ${industry}
Services: ${services_offered}
Location: ${location}
Tone: ${tone}
Primary Color: ${primary_color || '#4F46E5'}
Design Notes: ${art_direction || 'Use best judgment for this business type'}

PAGES TO GENERATE:
${pagesGuide}

Return ONLY the complete JSON object — no markdown, no explanation.`;

    // Call the selected AI provider
    const rawText = await generateWithProvider(resolvedProviderId, userPrompt, SYSTEM_INSTRUCTION);

    let websiteJson: any;
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      websiteJson = JSON.parse(cleaned);
    } catch (_e) {
      console.error(`[generate-website] JSON parse failed (${resolvedProviderId}). Raw:`, rawText.slice(0, 400));
      await db.from('website_briefs')
        .update({ generation_status: 'error', generation_error: `AI (${providerConfig.name}) returned invalid JSON.` })
        .eq('client_id', client_id);
      return errorResponse(`AI (${providerConfig.name}) returned invalid JSON. Please try again.`, 500);
    }

    if (!websiteJson.global || !Array.isArray(websiteJson.pages) || !websiteJson.pages.length) {
      await db.from('website_briefs')
        .update({ generation_status: 'error', generation_error: 'AI response missing required fields.' })
        .eq('client_id', client_id);
      return errorResponse('AI response missing required fields.', 500);
    }

    websiteJson.global.phone = websiteJson.global.phone || '';
    websiteJson.global.address = websiteJson.global.address || location;

    websiteJson.global.logo_url = '';
    websiteJson.global.hero_image_url = '';

    for (const page of websiteJson.pages) {
      page.sections = page.sections || [];
      if (!page.seo) {
        page.seo = { title: `${business_name} - ${page.name}`, meta_description: '', keywords: [] };
      }
    }

    const { error: saveError } = await db.from('website_briefs').update({
      website_json: websiteJson, client_slug, generation_status: 'complete', generation_error: null,
      ai_provider: resolvedProviderId,
    }).eq('client_id', client_id);

    if (saveError) {
      console.error('[generate-website] Save failed: ' + saveError.message);
      return errorResponse('Failed to save website: ' + saveError.message, 500);
    }

    console.log(`[generate-website] SUCCESS slug=${client_slug} pages=${websiteJson.pages.length} provider=${resolvedProviderId}`);
    return jsonResponse({
      success: true,
      client_slug,
      website_json: websiteJson,
      ai_provider: resolvedProviderId,
      ai_model: providerConfig.model,
    });

  } catch (error: any) {
    console.error('[generate-website] Error: ' + error.message);
    try {
      const b = await req.clone().json().catch(() => ({}));
      if (b && b.client_id) {
        await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
          .from('website_briefs')
          .update({ generation_status: 'error', generation_error: error.message })
          .eq('client_id', b.client_id);
      }
    } catch (_e2) { /* ignore */ }
    return errorResponse(error.message, 500);
  }
});
