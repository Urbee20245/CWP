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
    const { emailType, inputs } = await req.json();

    if (!emailType || !inputs || !inputs.keyPoints) {
      return errorResponse('Missing emailType or keyPoints in inputs.', 400);
    }
    
    console.log(`[generate-email-content] Generating email type: ${emailType} for ${inputs.clientName}`);

    const systemInstruction = `You are an expert email copywriter for a web development agency. Your task is to generate a professional email subject and body based on the provided context.
    
    CRITICAL RULES:
    1. The output MUST be a JSON object with two keys: "subject" (string) and "body" (string).
    2. The body should be formatted using simple Markdown (paragraphs, bold text, lists) for readability.
    3. Maintain the requested tone (e.g., Professional, Friendly, Firm).
    4. Ensure the email is concise and directly addresses the key points and call to action.
    5. Sign off professionally as "The Custom Websites Plus Team".
    
    Example Output: {"subject": "Your Project Update: Design Ready", "body": "Hi [Client Name],\\n\\nYour design mockups are ready for review..."}`;

    const prompt = `Generate a draft email of type "${emailType}" with a "${inputs.tone}" tone for client "${inputs.clientName}".
    
    Context:
    - Project: ${inputs.projectTitle || 'General Services'}
    - Key Points to Include: ${inputs.keyPoints}
    - Call to Action: ${inputs.callToAction || 'None specified.'}
    - Additional Notes: ${inputs.additionalNotes || 'Be professional.'}
    
    The email should be ready to send.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
            type: "object",
            properties: {
                subject: { type: "string", description: "The email subject line." },
                body: { type: "string", description: "The email body content, formatted in markdown." }
            },
            required: ["subject", "body"]
        },
        temperature: 0.7,
      },
    });

    const generatedJson = JSON.parse(response.text);

    return jsonResponse({ success: true, ...generatedJson });

  } catch (error: any) {
    console.error('[generate-email-content] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});