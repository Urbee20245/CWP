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

// Make slug unique by appending a short random suffix if needed
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

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Require authenticated session (admin only — enforced via RLS + app layer)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { client_id, business_name, industry, services_offered, location, tone, primary_color, art_direction } = await req.json();

    if (!client_id || !business_name || !industry || !services_offered || !location || !tone) {
      return errorResponse('Missing required brief fields.', 400);
    }

    console.log(`[generate-website] Generating for client_id=${client_id} business="${business_name}"`);

    // Mark status as generating
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

    const systemInstruction = `You are an expert web designer and copywriter specializing in local business websites.
Your job is to design a UNIQUE, complete website structure and write all copy for it.

OUTPUT FORMAT: Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
The JSON must match this exact schema:

{
  "global": {
    "business_name": string,
    "phone": string,
    "address": string,
    "primary_color": string,
    "font_heading": "Inter" | "Playfair Display" | "Montserrat" | "Raleway",
    "font_body": "Inter" | "Lato" | "Open Sans"
  },
  "seo": {
    "title": string,
    "meta_description": string,
    "keywords": string[]
  },
  "page_structure": [
    {
      "section_type": string,
      "variant": string,
      "content": object,
      "editable_fields": string[]
    }
  ]
}

AVAILABLE SECTIONS AND THEIR VARIANTS (pick the best for this business):
- hero: "centered_cta" | "split_image_left" | "bold_statement"
- services: "three_column_cards" | "icon_list" | "accordion"
- about: "left_text_right_stats" | "centered_story" | "founder_focus"
- social_proof: "star_testimonials" | "review_wall" | "stats_bar"
- contact_cta: "simple_form" | "phone_prominent" | "split_contact"
- faq: "accordion_simple" | "two_column"
- stats: "four_number_bar"
- gallery: "masonry_grid" | "simple_grid"

CONTENT REQUIREMENTS per section:
- hero: { headline, subheadline, cta_primary_text, cta_primary_link (use tel: for phone), background_style: "gradient" | "dark" | "light" }
- services: { heading, services: [{ name, description, icon: lucide icon name }] } — 3 to 6 services
- about: { heading, body, stat_1_number, stat_1_label, stat_2_number, stat_2_label }
- social_proof: { heading, reviews: [{ author, stars, text }] } — 2 to 3 reviews
- contact_cta: { heading, subtext, phone, email, hours }
- faq: { heading, faqs: [{ question, answer }] } — 4 to 6 FAQs relevant to their industry
- stats: { stats: [{ number, label }] } — 4 stats
- gallery: { heading, subtext }

EDITABLE FIELDS RULE — only include dot-path strings for fields the business owner might need to update:
- OK to include: contact_cta.content.phone, contact_cta.content.email, contact_cta.content.hours, global.phone, global.address, services.content.services[N].description
- NEVER include: headlines, section headings, variant choices, hero copy, brand decisions

DESIGN RULES:
1. Choose 4 to 6 sections that make sense for this specific industry
2. Make every word specific to their business — no generic filler text
3. Write urgency and specificity into the hero (include location and key service)
4. SEO title: max 60 chars. Meta description: max 155 chars.
5. Choose fonts that match the tone: Luxurious=Playfair Display, Bold=Montserrat, Professional=Inter, Friendly=Raleway
6. Return ONLY the JSON object. Nothing else.`;

    const userPrompt = `Design a website for this business:

Business Name: ${business_name}
Industry/Niche: ${industry}
Services Offered: ${services_offered}
Location: ${location}
Desired Tone: ${tone}
Primary Brand Color: ${primary_color || '#4F46E5'}
Art Direction Notes: ${art_direction || 'None — use your best judgment for this business type'}

Write compelling, specific copy. Choose sections that maximize conversions for this industry. Return the complete website JSON now.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.75,
        maxOutputTokens: 4096,
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
    if (!websiteJson.global || !websiteJson.seo || !Array.isArray(websiteJson.page_structure)) {
      await supabaseAdmin
        .from('website_briefs')
        .update({ generation_status: 'error', generation_error: 'AI response was missing required fields.' })
        .eq('client_id', client_id);
      return errorResponse('AI response was missing required fields.', 500);
    }

    // Ensure global phone/address have fallback values (AI may omit them)
    websiteJson.global.phone = websiteJson.global.phone || '';
    websiteJson.global.address = websiteJson.global.address || location;
    websiteJson.global.primary_color = primary_color || websiteJson.global.primary_color || '#4F46E5';

    // Generate unique slug
    const { data: existingBrief } = await supabaseAdmin
      .from('website_briefs')
      .select('client_slug')
      .eq('client_id', client_id)
      .single();

    const baseSlug = existingBrief?.client_slug || slugify(business_name);
    const client_slug = await makeUniqueSlug(supabaseAdmin, baseSlug, client_id);

    // Save completed website
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

    console.log(`[generate-website] Success for client_id=${client_id} slug="${client_slug}"`);
    return jsonResponse({ success: true, client_slug, website_json: websiteJson });

  } catch (error: any) {
    console.error('[generate-website] Unhandled error:', error.message);
    // Try to mark as error in DB
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
