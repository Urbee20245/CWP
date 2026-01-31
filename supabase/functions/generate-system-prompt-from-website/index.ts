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
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
        maxOutputTokens: 2000,
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
      return jsonRes({ success: false, error: 'AI service unavailable (missing GEMINI_API_KEY)' });
    }

    const { 
      website_url, 
      business_name,
      industry,
      tone,
      location,
      phone,
      services,
      special_instructions
    } = await req.json();

    const url = normalizeUrl(website_url);
    const biz = (business_name || '').trim();

    let websiteContext = "";
    if (url) {
      console.log('[generate-system-prompt-from-website] Fetching website content', { url });
      try {
        const siteRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CWPBot/1.0; +https://customwebsitesplus.com)' },
        });
        if (siteRes.ok) {
          const html = await siteRes.text();
          websiteContext = htmlToText(html).slice(0, 12000);
        }
      } catch (e) {
        console.warn('[generate-system-prompt-from-website] Website fetch failed, proceeding with provided fields only', e.message);
      }
    }

    const systemPromptInstruction = `You are an expert prompt engineer for AI phone receptionists.

Using the context below, write a high-quality, in-depth SYSTEM PROMPT for an AI call-handling agent.

CONTEXT:
- Business Name: ${biz || 'Unknown'}
- Industry: ${industry || 'Unknown'}
- Tone/Style: ${tone || 'Professional and friendly'}
- Location/Service Area: ${location || 'Unknown'}
- Business Phone: ${phone || 'Unknown'}
- Services Offered: ${services || 'Unknown'}
- Special Instructions: ${special_instructions || 'None'}
- Website Content: """${websiteContext}"""

STRUCTURE REQUIREMENTS:
You MUST follow this EXACT structure for the generated prompt:

1. IDENTITY & GOAL: Define the agent's name (e.g., Sarah), role, and primary goal (booking qualified discovery calls).
2. ABSOLUTE RULES: Include the "Value Proposition Structure", "Objection Handling", "Complete Sentences Only", "Booking Attempt", "Interest Check", and "Urgency/Scarcity" rules provided in the user's reference.
3. CONVERSATION FLOW: Step-by-step guide (Opening, Qualification, Discovery, Value Prop, Interest Check, Booking).
4. TOOL USAGE: Instructions for check-calendar-availability and book-appointment.
5. DO'S AND DON'TS: Specific behavioral guidelines.
6. FORBIDDEN PHRASES: List of things never to say.
7. SUCCESS CONDITION: Clear definition of a successful call.

CRITICAL: The "Value Proposition Structure" MUST acknowledge the situation, add social proof, quantify the problem, present the solution, and show the outcome as separate sentences.

Output ONLY the system prompt text. No markdown labels like "System Prompt:".`;

    const { json } = await callGemini(GEMINI_API_KEY, systemPromptInstruction);
    const generated = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();

    if (!generated) {
      return jsonRes({ success: false, error: 'AI returned empty output' });
    }

    return jsonRes({ success: true, system_prompt: generated });
  } catch (error: any) {
    console.error('[generate-system-prompt-from-website] Unhandled error', { message: error?.message });
    return jsonRes({ success: false, error: error?.message || 'Generation failed' });
  }
});
