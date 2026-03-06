export const config = { auth: false };

// ─── AI Command Edge Function ─────────────────────────────────────────────────
// Reliable command executor: ALWAYS modifies website JSON and saves it.
// Uses the user's selected AI provider (not hardcoded).
// Never gives text advice for imperative commands — always executes the change.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { generateWithProvider, DEFAULT_PROVIDER_ID } from "../_shared/ai-providers.ts";
import { SECTION_CAPABILITIES } from "../_shared/section-schema.ts";

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Strip code fences and find first { ────────────────────────────────────────

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = raw.indexOf("{");
  if (firstBrace !== -1) return raw.slice(firstBrace);
  return raw.trim();
}

// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Auth: require a valid user JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("Missing authorization header.", 401);

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return errorResponse("Unauthorized.", 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  try {
    const body = await req.json();
    const {
      client_id,
      command,
      provider = DEFAULT_PROVIDER_ID,
    } = body;

    if (!client_id || !command) {
      return errorResponse("Missing required fields: client_id, command.", 400);
    }

    // Verify the requesting user owns this client
    const { data: clientRow } = await supabaseAdmin
      .from("clients")
      .select("id, owner_profile_id")
      .eq("id", client_id)
      .single();

    if (!clientRow || clientRow.owner_profile_id !== user.id) {
      return errorResponse("Access denied.", 403);
    }

    // Fetch the current brief + business context
    const { data: brief, error: briefError } = await supabaseAdmin
      .from("website_briefs")
      .select("website_json, business_name, industry, services_offered, location, tone, primary_color")
      .eq("client_id", client_id)
      .single();

    if (briefError || !brief?.website_json) {
      return errorResponse("Website not found. Generate a site first.", 404);
    }

    const websiteJson = brief.website_json as any;

    // Save current JSON to website_json_previous before modifying (enables undo)
    await supabaseAdmin
      .from("website_briefs")
      .update({ website_json_previous: websiteJson })
      .eq("client_id", client_id);

    // Build system prompt
    const systemPrompt = `You are a website editor. The user will give you a command to modify their website.
You MUST return ONLY valid JSON — the complete updated website_json object.
Never return text, explanations, or markdown code blocks. Only the raw JSON object.

BUSINESS CONTEXT:
Business: ${brief.business_name}
Industry: ${brief.industry}
Location: ${brief.location}
Services: ${brief.services_offered}
Tone: ${brief.tone}
Brand color: ${brief.primary_color}

${SECTION_CAPABILITIES}

EDITING RULES:
- Return the COMPLETE website_json with the change applied — do not truncate or omit any pages or sections
- Adding a section: append to the appropriate page's sections array using correct section_type, variant, and content structure from the capabilities above
- Removing a section: filter it out of the sections array
- Changing content text: update the exact field value inside section.content
- Changing a layout variant: update section.variant to one of the valid variants for that section_type
- Changing colors: update global.primary_color and relevant content background/color fields
- Adding a new page: append to the pages array with id, name, slug, and sections
- Reordering sections: reorder within the sections array
- When adding sections, generate realistic, relevant content for the business — not placeholder text
- Always include editable_fields array on new sections listing the dot-paths of editable content fields`;

    const userPrompt = `Current website JSON:
${JSON.stringify(websiteJson)}

User command: ${command}

Return ONLY the complete updated website_json as a single JSON object with all pages and sections intact.`;

    console.log(`[ai-command] client=${client_id} provider=${provider} command="${command}"`);

    // Call the user's selected AI provider
    const rawText = await generateWithProvider(provider, userPrompt, systemPrompt);
    const jsonText = extractJson(rawText);

    let updatedJson: any;
    try {
      updatedJson = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error("[ai-command] JSON parse error:", (parseErr as Error).message);
      console.error("[ai-command] Raw response (first 500 chars):", rawText.slice(0, 500));
      return errorResponse("AI returned invalid JSON. Try rephrasing your command.", 422);
    }

    // Sanity check: must have pages array
    if (!updatedJson?.pages || !Array.isArray(updatedJson.pages)) {
      return errorResponse("AI response missing pages array. Try rephrasing your command.", 422);
    }

    // Save updated JSON back to DB
    const { error: saveError } = await supabaseAdmin
      .from("website_briefs")
      .update({
        website_json: updatedJson,
        ai_provider: provider,
      })
      .eq("client_id", client_id);

    if (saveError) {
      console.error("[ai-command] Save error:", saveError.message);
      return errorResponse("Failed to save changes.", 500);
    }

    // Generate a concise description of what changed using a brief second call
    // (lightweight — just ask for a 1-sentence summary)
    let description = "Changes applied successfully.";
    try {
      const descText = await generateWithProvider(
        provider,
        `I just applied this command to a website: "${command}". Summarize what changed in ONE short sentence (max 12 words). No punctuation at the end.`,
        "You generate ultra-concise summaries of website edits. Reply with only the summary sentence."
      );
      if (descText && descText.length < 120) {
        description = descText.trim().replace(/\.$/, "");
      }
    } catch {
      // Non-fatal — description stays as fallback
    }

    console.log(`[ai-command] Success. client=${client_id} description="${description}"`);
    return jsonResponse({ success: true, updated_json: updatedJson, description });

  } catch (error: any) {
    console.error("[ai-command] Unhandled error:", error.message);
    return errorResponse(error.message || "Internal server error.", 500);
  }
});
