export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set.');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { entity_type, entity_name, entity_category, pricing_type, key_features, tone, additional_notes } = await req.json();

    if (!entity_type || !entity_name) {
      return errorResponse('Missing required fields', 400);
    }

    console.log(`[generate-admin-content] Generating for ${entity_type}: ${entity_name}`);

    const systemInstruction = `You are a professional content writer. Generate descriptions for products and services.

RULES:
- Output ONLY the description text
- No markdown formatting
- No preamble or postamble
- Focus on value and features
- No legal guarantees or specific pricing promises`;

    const prompt = `Generate a description for a ${entity_type} named "${entity_name}".

Context:
- Category: ${entity_category || 'N/A'}
- Pricing Type: ${pricing_type || 'N/A'}
- Key Features: ${key_features || 'None provided'}
- Tone: ${tone}
- Additional Instructions: ${additional_notes || 'Be concise'}

Generate the description now:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const generatedContent = response.text?.trim();

    if (!generatedContent) {
      return errorResponse('AI returned empty content', 500);
    }

    console.log('[generate-admin-content] Success');
    return jsonResponse({ success: true, content: generatedContent });

  } catch (error: any) {
    console.error('[generate-admin-content] Error:', error.message);
    return errorResponse(error.message || 'Generation failed', 500);
  }
});
