import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GEMINI_API_KEY) {
      console.error('[generate-admin-content] GEMINI_API_KEY missing');
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { entity_type, entity_name, entity_category, pricing_type, key_features, tone, additional_notes } = await req.json();

    if (!entity_type || !entity_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log(`[generate-admin-content] Generating for ${entity_type}: ${entity_name}`);

    const prompt = `You are a professional content writer. Generate a description for a ${entity_type} named "${entity_name}".

Context:
- Category: ${entity_category || 'N/A'}
- Pricing Type: ${pricing_type || 'N/A'}
- Key Features: ${key_features || 'None provided'}
- Tone: ${tone}
- Additional Instructions: ${additional_notes || 'Be concise'}

RULES:
- Output ONLY the description text
- No markdown formatting
- No preamble or postamble
- Maintain the ${tone} tone
- Focus on value and features
- No legal guarantees or specific pricing promises

Generate the description now:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-admin-content] API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI generation failed' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();
    const generatedContent = data.candidates[0].content.parts[0].text.trim();

    console.log('[generate-admin-content] Success');
    return new Response(
      JSON.stringify({ success: true, content: generatedContent }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[generate-admin-content] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Generation failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
});