export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizeUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('[generate-system-prompt-from-website] Missing GEMINI_API_KEY');
      return jsonRes({ error: 'AI service unavailable' }, 500);
    }

    const { website_url, business_name } = await req.json();
    const url = normalizeUrl(website_url);
    const biz = typeof business_name === 'string' ? business_name.trim() : '';

    if (!url) {
      return jsonRes({ error: 'Missing website_url' }, 400);
    }

    console.log('[generate-system-prompt-from-website] Fetching website content', { url });

    const siteRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CWPBot/1.0; +https://customwebsitesplus.com)'
      },
    });

    if (!siteRes.ok) {
      const text = await siteRes.text();
      console.error('[generate-system-prompt-from-website] Website fetch failed', { status: siteRes.status, body: text?.slice?.(0, 200) });
      return jsonRes({ error: `Failed to fetch website (HTTP ${siteRes.status})` }, 400);
    }

    const html = await siteRes.text();
    const extractedText = htmlToText(html);

    // Keep the prompt payload small to avoid token blowups.
    const websiteTextForModel = extractedText.slice(0, 12000);

    console.log('[generate-system-prompt-from-website] Calling Gemini', { chars: websiteTextForModel.length });

    const systemPromptInstruction = `You are an expert prompt engineer for AI phone receptionists.

Using the website text below, write a high-quality SYSTEM PROMPT for an AI call-handling agent for the business.

REQUIREMENTS:
- Output ONLY the system prompt text (no markdown, no labels)
- Assume this is a voice/phone agent that answers inbound calls
- Include: business overview, services, service area/location, hours if found, how to handle pricing questions, FAQs, how to book/next steps, and tone/brand style
- If something is unknown, instruct the agent to ask clarifying questions rather than guessing
- Keep it practical, structured, and easy to follow

Business name (if known): ${biz || 'Unknown'}

Website text:
"""${websiteTextForModel}"""`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPromptInstruction }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 900,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('[generate-system-prompt-from-website] Gemini API error', { err: err?.slice?.(0, 500) });
      return jsonRes({ error: 'AI generation failed' }, 500);
    }

    const data = await geminiRes.json();
    const generated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();

    if (!generated) {
      console.error('[generate-system-prompt-from-website] Empty model output');
      return jsonRes({ error: 'AI returned empty output' }, 500);
    }

    console.log('[generate-system-prompt-from-website] Success');
    return jsonRes({ success: true, system_prompt: generated });
  } catch (error: any) {
    console.error('[generate-system-prompt-from-website] Unhandled error', { message: error?.message });
    return jsonRes({ error: error?.message || 'Generation failed' }, 500);
  }
});
