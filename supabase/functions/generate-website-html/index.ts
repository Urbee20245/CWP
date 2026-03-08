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

const SYSTEM_PROMPT = `You are an elite web designer and front-end developer. You create stunning, modern, professional websites that look like they were built by a top agency.

Generate a COMPLETE, SINGLE-FILE HTML website with ALL CSS embedded in a <style> tag and ALL JavaScript embedded in a <script> tag at the bottom of the body.

DESIGN REQUIREMENTS — these are non-negotiable:
- Use the provided primary color BOLDLY — as hero background, nav background, or major section backgrounds. Never relegate it to just button accents.
- Create strong visual hierarchy with dramatic typography — large bold headings, clear subheadings
- Alternate section backgrounds: use the primary color, a dark version of it, white, and light gray — never all-white sections
- Use modern CSS: CSS Grid, Flexbox, CSS custom properties (variables), smooth transitions, hover effects
- Include a sticky navigation bar with the business name/logo and nav links
- Hero section must be BOLD and full-viewport — large headline, subheadline, CTA button, no placeholder images (use CSS gradients, shapes, or icons instead)
- Include at minimum: Hero, Services/Features (cards with icons), About/Story, Testimonials or Stats, Contact section with a form, Footer
- Use Google Fonts — link ONE font family at the top for headings (e.g. Playfair Display, Montserrat, or Raleway) and a clean body font
- All text must be real, specific, relevant business copy — NO "Lorem ipsum", NO placeholder text
- The contact form should have fields: Name, Phone, Email, Message and a Submit button
- Mobile responsive using media queries
- Smooth scroll behavior
- Add subtle animations: fade-in on scroll (use Intersection Observer), hover transforms on cards
- Color palette: derive a complementary secondary color and accent from the primary

ICONS: Use inline SVG for icons throughout — services section, features, footer social links. Keep them simple and clean.

QUALITY BAR: The output must look like it costs $5,000+ to build. Think premium agency work.

OUTPUT: Return ONLY the complete HTML document. Start with <!DOCTYPE html>.
No explanations, no markdown, no code fences. Just the raw HTML.`;

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
      business_name,
      industry,
      services,
      location,
      phone = '',
      email = '',
      tone = 'professional',
      primary_color = '#4F46E5',
      secondary_color = '',
      art_direction = '',
      provider = DEFAULT_PROVIDER_ID,
    } = body;

    if (!client_id || !business_name || !industry || !services || !location) {
      return errorResponse('Missing required fields: client_id, business_name, industry, services, location.', 400);
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

    const providerConfig = AI_PROVIDERS[provider] || AI_PROVIDERS[DEFAULT_PROVIDER_ID];
    const resolvedProviderId = providerConfig.id;

    console.log(`[generate-website-html] client_id=${client_id} provider=${resolvedProviderId}`);

    // Mark as generating
    await db.from('website_briefs').upsert({
      client_id,
      business_name,
      industry,
      services_offered: services,
      location,
      phone,
      email,
      tone,
      primary_color,
      art_direction: art_direction || null,
      site_type: 'raw_html',
      generation_status: 'generating',
      generation_error: null,
    }, { onConflict: 'client_id' });

    const userPrompt = `Build a complete professional website for this business:

Business Name: ${business_name}
Industry: ${industry}
Services: ${services}
Location: ${location}
Phone: ${phone || 'Contact for pricing'}
Email: ${email || 'Contact via form'}
Tone/Style: ${tone}
Primary Brand Color: ${primary_color}${secondary_color ? `\nSecondary Color: ${secondary_color}` : ''}
Additional Design Notes: ${art_direction || 'Use best judgment for this business type'}

Generate the full HTML website now.`;

    // Use higher token limit for HTML generation (full site)
    const rawHtml = await generateWithProvider(resolvedProviderId, userPrompt, SYSTEM_PROMPT);

    // Strip any accidental markdown code fences
    const cleanedHtml = rawHtml
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (!cleanedHtml.toLowerCase().startsWith('<!doctype') && !cleanedHtml.toLowerCase().startsWith('<html')) {
      await db.from('website_briefs')
        .update({ generation_status: 'error', generation_error: 'AI returned invalid HTML.' })
        .eq('client_id', client_id);
      return errorResponse('AI returned invalid HTML. Please try again.', 500);
    }

    // Save HTML to database
    const { error: saveError } = await db.from('website_briefs').update({
      raw_html: cleanedHtml,
      site_type: 'raw_html',
      is_published: true,
      is_generation_complete: true,
      generation_status: 'complete',
      generation_error: null,
      ai_provider: resolvedProviderId,
    }).eq('client_id', client_id);

    if (saveError) {
      console.error('[generate-website-html] Save error:', saveError.message);
      return errorResponse('Failed to save website: ' + saveError.message, 500);
    }

    console.log(`[generate-website-html] SUCCESS client_id=${client_id} provider=${resolvedProviderId} html_length=${cleanedHtml.length}`);
    return jsonResponse({ success: true, raw_html: cleanedHtml });

  } catch (error: any) {
    console.error('[generate-website-html] Error:', error.message);
    try {
      const b = await req.clone().json().catch(() => ({}));
      if (b?.client_id) {
        await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
          .from('website_briefs')
          .update({ generation_status: 'error', generation_error: error.message })
          .eq('client_id', b.client_id);
      }
    } catch { /* ignore */ }
    return errorResponse(error.message || 'Internal server error.', 500);
  }
});
