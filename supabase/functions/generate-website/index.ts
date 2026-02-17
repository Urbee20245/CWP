export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set.');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function makeUniqueSlug(supabaseAdmin: any, base: string, excludeClientId?: string): Promise<string> {
  let slug = slugify(base);
  let attempt = 0;

  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    let query = supabaseAdmin
      .from('website_briefs')
      .select('id, client_id')
      .eq('client_slug', candidate);

    const { data } = await query;
    const conflict = (data || []).find((r: any) => r.client_id !== excludeClientId);
    if (!conflict) return candidate;
    attempt++;
  }
}

// Per-page section guidance for the AI
const PAGE_SECTION_GUIDE: Record<string, string> = {
  home: 'Required sections: hero (1), services (1), stats (1), social_proof (1), contact_cta (1). Choose compelling variants.',
  about: 'Required sections: about (1), stats (1), social_proof (1), contact_cta (1). Tell the company story.',
  services: 'Required sections: hero (1, services-focused), services (1, detailed), faq (1, service-related), contact_cta (1).',
  contact: 'Required sections: contact_cta (1, full-form variant), faq (1, contact/process FAQs).',
  gallery: 'Required sections: gallery (1, masonry_grid or simple_grid), contact_cta (1). Gallery heading should mention portfolio/work.',
  faq: 'Required sections: faq (1, extensive — 8 to 12 FAQs covering all common questions), contact_cta (1).',
  testimonials: 'Required sections: social_proof (1, review_wall variant — 4 to 6 reviews), stats (1), contact_cta (1).',
  pricing: 'Required sections: pricing_cards (1, 3 tiers), faq (1, pricing/package FAQs), contact_cta (1).',
  blog: 'Required sections: blog_preview (1, heading + subtext only — posts are fetched from database), contact_cta (1).',
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const {
      client_id,
      business_name,
      industry,
      services_offered,
      location,
      tone,
      primary_color,
      art_direction,
      pages_to_generate,
    } = await req.json();

    if (!client_id || !business_name || !industry || !services_offered || !location || !tone) {
      return errorResponse('Missing required brief fields.', 400);
    }

    // Default to home + about + services + contact if not specified
    const selectedPages: string[] = Array.isArray(pages_to_generate) && pages_to_generate.length > 0
      ? pages_to_generate
      : ['home', 'about', 'services', 'contact'];

    // Always include home
    if (!selectedPages.includes('home')) selectedPages.unshift('home');

    console.log(`[generate-website] Generating for client_id=${client_id} business="${business_name}" pages=${selectedPages.join(',')}`);

    await supabaseAdmin
      .from('website_briefs')
      .upsert({
        client_id,
        business_name,
        industry,
        services_offered,
        location,
        tone,
        primary_color: primary_color || '#4F46E5',
        art_direction: art_direction || null,
        generation_status: 'generating',
        generation_error: null,
      }, { onConflict: 'client_id' });

    const pageSlugMap: Record<string, string> = {
      home: '',
      about: 'about',
      services: 'services',
      contact: 'contact',
      gallery: 'gallery',
      faq: 'faq',
      testimonials: 'testimonials',
      pricing: 'pricing',
      blog: 'blog',
    };

    const pageNameMap: Record<string, string> = {
      home: 'Home',
      about: 'About Us',
      services: 'Services',
      contact: 'Contact Us',
      gallery: 'Gallery',
      faq: 'FAQ',
      testimonials: 'Testimonials',
      pricing: 'Pricing',
      blog: 'Blog',
    };

    const pagesGuide = selectedPages.map(p => {
      return `  PAGE "${p}" (name: "${pageNameMap[p]}", slug: "${pageSlugMap[p]}"):\n    ${PAGE_SECTION_GUIDE[p] || 'Include relevant sections.'}`;
    }).join('\n\n');

    const systemInstruction = `You are an expert web designer and copywriter specializing in local business websites.
Your job is to design a UNIQUE, complete MULTI-PAGE website with compelling copy for each page.

OUTPUT FORMAT: Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
The JSON must match this exact schema:

{
  "global": {
    "business_name": string,
    "phone": string,
    "address": string,
    "primary_color": string,
    "font_heading": "Inter" | "Playfair Display" | "Montserrat" | "Raleway",
    "font_body": "Inter" | "Lato" | "Open Sans",
    "logo_url": "",
    "hero_image_url": ""
  },
  "pages": [
    {
      "id": string,
      "name": string,
      "slug": string,
      "seo": {
        "title": string,
        "meta_description": string,
        "keywords": string[]
      },
      "sections": [
        {
          "section_type": string,
          "variant": string,
          "content": object,
          "editable_fields": string[]
        }
      ]
    }
  ]
}

AVAILABLE SECTION TYPES AND VARIANTS:
- hero: "centered_cta" | "split_image_left" | "bold_statement"
- services: "three_column_cards" | "icon_list" | "accordion"
- about: "left_text_right_stats" | "centered_story" | "founder_focus"
- social_proof: "star_testimonials" | "review_wall" | "stats_bar"
- contact_cta: "simple_form" | "phone_prominent" | "split_contact"
- faq: "accordion_simple" | "two_column"
- stats: "four_number_bar"
- gallery: "masonry_grid" | "simple_grid"
- pricing_cards: "three_tier" | "two_tier"
- blog_preview: "card_grid"

CONTENT REQUIREMENTS per section_type:
- hero: { headline, subheadline, cta_primary_text, cta_primary_link (use tel: for phone), background_style: "gradient"|"dark"|"light" }
- services: { heading, services: [{ name, description, icon: lucide-icon-name }] } — 3 to 6 services
- about: { heading, body, stat_1_number, stat_1_label, stat_2_number, stat_2_label }
- social_proof: { heading, reviews: [{ author, stars, text }] } — use 2-3 for smaller pages, 4-6 for testimonials page
- contact_cta: { heading, subtext, phone, email, hours }
- faq: { heading, faqs: [{ question, answer }] } — follow page guide for count
- stats: { stats: [{ number, label }] } — exactly 4 stats
- gallery: { heading, subtext }
- pricing_cards: { heading, subtext, tiers: [{ name, price, period: "month"|"one-time"|"project", description, features: string[], cta_text, highlighted: boolean }] }
- blog_preview: { heading, subtext }

EDITABLE FIELDS RULE — only include dot-path strings clients might update:
- GOOD: contact_cta.content.phone, contact_cta.content.email, contact_cta.content.hours, global.phone, global.address, services.content.services[N].description
- NEVER include: headlines, hero copy, brand decisions, section headings

SEO RULES:
- Each page gets unique title and meta_description
- Title: max 60 chars, include business name + page topic
- Meta description: max 155 chars, include location and key benefit
- Keywords: 5-8 per page, location-specific

DESIGN RULES:
- Every word must be specific to this business — no generic filler
- Use location and services throughout hero copy
- Fonts: Luxurious=Playfair Display, Bold=Montserrat, Professional=Inter, Friendly=Raleway
- Return ONLY the JSON object. Nothing else.`;

    const userPrompt = `Design a multi-page website for this business:

Business Name: ${business_name}
Industry/Niche: ${industry}
Services Offered: ${services_offered}
Location: ${location}
Desired Tone: ${tone}
Primary Brand Color: ${primary_color || '#4F46E5'}
Art Direction Notes: ${art_direction || 'None — use your best judgment for this business type'}

PAGES TO GENERATE (generate exactly these pages in this order):
${pagesGuide}

Write compelling, location-specific copy for EVERY page. Each page must feel distinct and purposeful.
Return the complete multi-page website JSON now.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.75,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text?.trim() || '';
    let websiteJson: any;

    try {
      websiteJson = JSON.parse(rawText);
    } catch {
      console.error('[generate-website] Failed to parse AI response as JSON:', rawText.slice(0, 300));
      await supabaseAdmin
        .from('website_briefs')
        .update({ generation_status: 'error', generation_error: 'AI returned invalid JSON. Please try again.' })
        .eq('client_id', client_id);
      return errorResponse('AI returned invalid JSON. Please try again.', 500);
    }

    // Validate required top-level keys
    if (!websiteJson.global || !Array.isArray(websiteJson.pages) || websiteJson.pages.length === 0) {
      await supabaseAdmin
        .from('website_briefs')
        .update({ generation_status: 'error', generation_error: 'AI response was missing required fields.' })
        .eq('client_id', client_id);
      return errorResponse('AI response was missing required fields.', 500);
    }

    // Ensure global fields have fallback values
    websiteJson.global.phone = websiteJson.global.phone || '';
    websiteJson.global.address = websiteJson.global.address || location;
    websiteJson.global.primary_color = primary_color || websiteJson.global.primary_color || '#4F46E5';
    websiteJson.global.logo_url = websiteJson.global.logo_url || '';
    websiteJson.global.hero_image_url = websiteJson.global.hero_image_url || '';

    // Ensure each page has required fields
    for (const page of websiteJson.pages) {
      if (!page.id || !page.name || !Array.isArray(page.sections)) {
        page.sections = page.sections || [];
      }
      if (!page.seo) {
        page.seo = { title: `${business_name} — ${page.name}`, meta_description: '', keywords: [] };
      }
    }

    // Generate unique slug
    const { data: existingBrief } = await supabaseAdmin
      .from('website_briefs')
      .select('client_slug')
      .eq('client_id', client_id)
      .single();

    const baseSlug = existingBrief?.client_slug || slugify(business_name);
    const client_slug = await makeUniqueSlug(supabaseAdmin, baseSlug, client_id);

    const { error: saveError } = await supabaseAdmin
      .from('website_briefs')
      .update({
        website_json: websiteJson,
        client_slug,
        generation_status: 'complete',
        generation_error: null,
      })
      .eq('client_id', client_id);

    if (saveError) {
      console.error('[generate-website] Failed to save website:', saveError.message);
      return errorResponse('Failed to save generated website.', 500);
    }

    console.log(`[generate-website] Success for client_id=${client_id} slug="${client_slug}" pages=${websiteJson.pages.length}`);
    return jsonResponse({ success: true, client_slug, website_json: websiteJson });

  } catch (error: any) {
    console.error('[generate-website] Unhandled error:', error.message);
    try {
      const body = await req.json().catch(() => ({}));
      if (body.client_id) {
        const supabaseAdmin2 = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabaseAdmin2
          .from('website_briefs')
          .update({ generation_status: 'error', generation_error: error.message })
          .eq('client_id', body.client_id);
      }
    } catch { /* ignore */ }
    return errorResponse(error.message, 500);
  }
});
