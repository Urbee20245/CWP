export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonRes(body: any) {
  // IMPORTANT: Always return 200 so the client SDK doesn't hide the real error
  // behind a generic "non-2xx" message. We communicate success/failure in JSON.
  return new Response(JSON.stringify(body), { status: 200, headers: corsHeaders });
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

async function callGemini(apiKey: string, prompt: string) {
  // User-requested model for consistency across the app.
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  console.log('[generate-system-prompt-from-website] Calling Gemini', { model });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 900,
      },
    }),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error?.message || json?.message || json?.detail || text || `HTTP ${res.status}`;
    console.error('[generate-system-prompt-from-website] Gemini API error', {
      model,
      status: res.status,
      message: msg?.slice?.(0, 500) || msg,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Unauthorized to Gemini API (check GEMINI_API_KEY)');
    }

    throw new Error(`Model ${model}: ${msg}`);
  }

  return { model, json };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('[generate-system-prompt-from-website] Missing GEMINI_API_KEY');
      return jsonRes({ success: false, error: 'AI service unavailable (missing GEMINI_API_KEY)' });
    }

    const { website_url, business_name } = await req.json();
    const url = normalizeUrl(website_url);
    const biz = typeof business_name === 'string' ? business_name.trim() : '';

    if (!url) {
      return jsonRes({ success: false, error: 'Missing website_url' });
    }

    console.log('[generate-system-prompt-from-website] Fetching website content', { url });

    const siteRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CWPBot/1.0; +https://customwebsitesplus.com)'
      },
    });

    if (!siteRes.ok) {
      const text = await siteRes.text();
      console.error('[generate-system-prompt-from-website] Website fetch failed', {
        status: siteRes.status,
        body: text?.slice?.(0, 200),
      });
      return jsonRes({ success: false, error: `Failed to fetch website (HTTP ${siteRes.status})` });
    }

    const html = await siteRes.text();
    const extractedText = htmlToText(html);

    // Keep the prompt payload small to avoid token blowups.
    const websiteTextForModel = extractedText.slice(0, 12000);

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

    const { model, json } = await callGemini(GEMINI_API_KEY, systemPromptInstruction);

    const generated = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();

    if (!generated) {
      console.error('[generate-system-prompt-from-website] Empty model output', { model });
      return jsonRes({ success: false, error: 'AI returned empty output' });
    }

    console.log('[generate-system-prompt-from-website] Success', { model });
    return jsonRes({ success: true, system_prompt: generated, model });
  } catch (error: any) {
    console.error('[generate-system-prompt-from-website] Unhandled error', { message: error?.message });
    return jsonRes({ success: false, error: error?.message || 'Generation failed' });
  }
});