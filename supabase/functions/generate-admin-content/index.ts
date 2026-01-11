import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.2.1';

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
      console.error('[generate-admin-content] GEMINI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'AI service unavailable - API key missing' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const { entity_type, entity_name, entity_category, pricing_type, key_features, tone, additional_notes } = await req.json();

    if (!entity_type || !entity_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: entity_type or entity_name' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log(`[generate-admin-content] Generating content for ${entity_type}: ${entity_name}`);

    const systemInstruction = `You are a professional, concise, and highly effective content drafting assistant for an agency's internal use. Your goal is to generate a description or summary based on the provided context and tone.
    
CRITICAL RULES:
1. The output must be ONLY the generated text, without any conversational preamble, postamble, or markdown formatting (unless specifically requested by the user).
2. Maintain the requested tone (e.g., professional, concise, marketing-friendly).
3. Do NOT mention AI, automation, or internal system details in the output.
4. Avoid making legal guarantees or specific pricing promises.
5. Focus on the value proposition and key features provided.`;

    const prompt = `${systemInstruction}

Generate a description for a ${entity_type} named "${entity_name}".

Context:
- Category: ${entity_category || 'N/A'}
- Pricing Type: ${pricing_type || 'N/A'}
- Key Features/Points: ${key_features || 'None provided.'}
- Tone: ${tone}
- Additional Instructions: ${additional_notes || 'Be concise.'}

The description should be suitable for a client-facing document or internal reference.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedContent = response.text().trim();

    console.log('[generate-admin-content] Content generated successfully');
    return new Response(
      JSON.stringify({ success: true, content: generatedContent }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[generate-admin-content] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Content generation failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
});