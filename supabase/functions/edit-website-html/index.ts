export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { generateWithProvider, DEFAULT_PROVIDER_ID } from '../_shared/ai-providers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SYSTEM_PROMPT = `You are a professional web developer editing an existing HTML website. The user will give you a command describing what to change. Return the COMPLETE updated HTML document with the change applied. Preserve all existing content and structure except what needs to change. Return ONLY the raw HTML. No explanations, no markdown, no code fences.`;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  // Auth: verify JWT via supabase anon client
  const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
  if (userError || !user) return errorResponse('Unauthorized.', 401);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const {
      client_id,
      command,
      provider = DEFAULT_PROVIDER_ID,
    } = body;

    if (!client_id || !command) {
      return errorResponse('Missing required fields: client_id, command.', 400);
    }

    // Verify requesting user owns this client
    const { data: clientRow } = await db
      .from('clients')
      .select('id, owner_profile_id')
      .eq('id', client_id)
      .single();

    if (!clientRow || clientRow.owner_profile_id !== user.id) {
      return errorResponse('Access denied.', 403);
    }

    // Fetch current HTML
    const { data: brief, error: briefError } = await db
      .from('website_briefs')
      .select('raw_html')
      .eq('client_id', client_id)
      .single();

    if (briefError || !brief?.raw_html) {
      return errorResponse('HTML website not found. Generate a site first.', 404);
    }

    // Save current HTML to raw_html_previous (for undo)
    await db
      .from('website_briefs')
      .update({ raw_html_previous: brief.raw_html })
      .eq('client_id', client_id);

    const userPrompt = `Here is the current website HTML:

${brief.raw_html}

User command: ${command}

Return the complete updated HTML with this change applied.`;

    console.log(`[edit-website-html] client=${client_id} provider=${provider} command="${command}"`);

    const rawResult = await generateWithProvider(provider, userPrompt, SYSTEM_PROMPT);

    // Strip any accidental code fences
    const updatedHtml = rawResult
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (!updatedHtml.toLowerCase().startsWith('<!doctype') && !updatedHtml.toLowerCase().startsWith('<html')) {
      return errorResponse('AI returned invalid HTML. Try rephrasing your command.', 422);
    }

    // Save updated HTML
    const { error: saveError } = await db
      .from('website_briefs')
      .update({ raw_html: updatedHtml, ai_provider: provider })
      .eq('client_id', client_id);

    if (saveError) {
      console.error('[edit-website-html] Save error:', saveError.message);
      return errorResponse('Failed to save changes.', 500);
    }

    // Generate a concise description of the change
    let description = 'Changes applied successfully.';
    try {
      const descText = await generateWithProvider(
        provider,
        `I just applied this command to a website: "${command}". Summarize what changed in ONE short sentence (max 12 words). No punctuation at the end.`,
        'You generate ultra-concise summaries of website edits. Reply with only the summary sentence.'
      );
      if (descText && descText.length < 120) {
        description = descText.trim().replace(/\.$/, '');
      }
    } catch { /* Non-fatal */ }

    console.log(`[edit-website-html] Success. client=${client_id} description="${description}"`);
    return jsonResponse({ success: true, raw_html: updatedHtml, description });

  } catch (error: any) {
    console.error('[edit-website-html] Error:', error.message);
    return errorResponse(error.message || 'Internal server error.', 500);
  }
});
