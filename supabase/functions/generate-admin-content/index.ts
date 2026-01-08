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
      return errorResponse('Missing required fields: entity_type or entity_name.', 400);
    }
    
    console.log(`[generate-admin-content] Generating content for ${entity_type}: ${entity_name}`);

    const systemInstruction = `You are a professional, concise, and highly effective content drafting assistant for an agency's internal use. Your goal is to generate a description or summary based on the provided context and tone.
    
    CRITICAL RULES:
    1. The output must be ONLY the generated text, without any conversational preamble, postamble, or markdown formatting (unless specifically requested by the user).
    2. Maintain the requested tone (e.g., professional, concise, marketing-friendly).
    3. Do NOT mention AI, automation, or internal system details in the output.
    4. Avoid making legal guarantees or specific pricing promises.
    5. Focus on the value proposition and key features provided.`;

    const prompt = `Generate a description for a ${entity_type} named "${entity_name}".
    
    Context:
    - Category: ${entity_category || 'N/A'}
    - Pricing Type: ${pricing_type || 'N/A'}
    - Key Features/Points: ${key_features || 'None provided.'}
    - Tone: ${tone}
    - Additional Instructions: ${additional_notes || 'Be concise.'}
    
    The description should be suitable for a client-facing document or internal reference.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.6,
      },
    });

    const generatedContent = response.text.trim();

    return jsonResponse({ success: true, content: generatedContent });

  } catch (error: any) {
    console.error('[generate-admin-content] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});