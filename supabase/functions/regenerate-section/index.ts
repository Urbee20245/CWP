export const config = { auth: false };

// ─── Regenerate Section Edge Function ────────────────────────────────────────
// Regenerates a single section of an existing website using the selected AI
// provider, then persists the updated website_json back to the brief.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { generateWithProvider, DEFAULT_PROVIDER_ID } from '../_shared/ai-providers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── System prompt describing valid section JSON ────────────────────────────────

const SECTION_SCHEMA = `You are an expert web designer and copywriter regenerating ONE section of an existing website.
Return ONLY valid JSON for the section — no markdown, no code fences, nothing else.

Section schema:
{
  "section_type": string,
  "variant": string,
  "content": object,
  "editable_fields": string[]
}

SECTION TYPES + VARIANTS:
hero: centered_cta | split_image_left | bold_statement | minimal_text
services: three_column_cards | icon_list | accordion | two_column_detailed
about: left_text_right_stats | centered_story | founder_focus | mission_values
social_proof: star_testimonials | review_wall | stats_bar
contact_cta: simple_form | phone_prominent | split_contact | minimal_cta
contact_form: single_column | two_column_split
faq: accordion_list | two_column_qa | simple_list
stats: four_stats_bar | centered_three | side_by_side
gallery: masonry_grid | four_card_grid | carousel_preview
pricing_cards: three_tier | two_tier | single_featured
blog_preview: three_card_grid | featured_plus_two | minimal_list
team: three_card_grid | founder_focus | four_card_grid
menu_section: category_grid | full_menu_list | featured_items

editable_fields: dot-paths into content that clients can edit (e.g. "content.headline", "content.services[0].name").`;

// ── Helper: strip JSON code fences if AI returns them ─────────────────────────

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = raw.indexOf('{');
  if (firstBrace !== -1) return raw.slice(firstBrace);
  return raw.trim();
}

// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Auth: require a valid user JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return errorResponse('Unauthorized.', 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const {
      client_id,
      page_id,
      section_index,
      custom_prompt,
      ai_provider = DEFAULT_PROVIDER_ID,
    } = body;

    if (!client_id || page_id === undefined || section_index === undefined) {
      return errorResponse('Missing required fields: client_id, page_id, section_index.', 400);
    }

    // Verify the requesting user owns this client
    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('id, owner_profile_id')
      .eq('id', client_id)
      .single();

    if (!clientRow || clientRow.owner_profile_id !== user.id) {
      return errorResponse('Access denied.', 403);
    }

    // Fetch the current brief
    const { data: brief, error: briefError } = await supabaseAdmin
      .from('website_briefs')
      .select('website_json, business_name, industry, services_offered, location, tone, primary_color')
      .eq('client_id', client_id)
      .single();

    if (briefError || !brief?.website_json) {
      return errorResponse('Website not found.', 404);
    }

    const websiteJson = brief.website_json as any;
    const targetPage = websiteJson.pages?.find((p: any) => p.id === page_id);
    if (!targetPage) {
      return errorResponse(`Page "${page_id}" not found in website JSON.`, 404);
    }

    const targetSection = targetPage.sections?.[section_index];
    if (!targetSection) {
      return errorResponse(`Section at index ${section_index} not found on page "${page_id}".`, 404);
    }

    console.log(
      `[regenerate-section] client=${client_id} page=${page_id} section_index=${section_index} ` +
      `section_type=${targetSection.section_type} provider=${ai_provider}`
    );

    // Build prompt
    const userPrompt = `
Business: ${brief.business_name}
Industry: ${brief.industry}
Location: ${brief.location}
Services: ${brief.services_offered}
Brand tone: ${brief.tone}
Brand color: ${brief.primary_color}
Page: ${page_id}

Current section (regenerate this with fresh, compelling content):
${JSON.stringify(targetSection, null, 2)}

${custom_prompt ? `Additional instruction: ${custom_prompt}` : 'Regenerate this section with fresh, compelling content that fits the business.'}

Return ONLY the JSON for the regenerated section — same section_type, a fresh variant selection, updated content.`;

    // Generate with selected provider
    const rawText = await generateWithProvider(ai_provider, userPrompt, SECTION_SCHEMA);
    const jsonText = extractJson(rawText);
    const newSection = JSON.parse(jsonText);

    // Validate the returned section has required fields
    if (!newSection.section_type || !newSection.content) {
      throw new Error('AI returned an invalid section structure.');
    }

    // Merge into the website JSON
    const updatedPages = websiteJson.pages.map((page: any) => {
      if (page.id !== page_id) return page;
      const newSections = [...(page.sections || [])];
      newSections[section_index] = newSection;
      return { ...page, sections: newSections };
    });

    const updatedJson = { ...websiteJson, pages: updatedPages };

    // Save back + update ai_provider to reflect last-used provider
    const { error: saveError } = await supabaseAdmin
      .from('website_briefs')
      .update({
        website_json: updatedJson,
        ai_provider,
      })
      .eq('client_id', client_id);

    if (saveError) {
      console.error('[regenerate-section] Save error:', saveError.message);
      return errorResponse('Failed to save regenerated section.', 500);
    }

    console.log(`[regenerate-section] Saved. client=${client_id} page=${page_id} section_index=${section_index}`);
    return jsonResponse({ success: true, section: newSection, website_json: updatedJson });

  } catch (error: any) {
    console.error('[regenerate-section] Unhandled error:', error.message);
    return errorResponse(error.message || 'Internal server error.', 500);
  }
});
