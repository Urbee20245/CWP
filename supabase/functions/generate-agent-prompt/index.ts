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
    const {
      business_name,
      industry,
      services,
      tone,
      agent_name,
      phone_number,
      location,
      business_hours_summary,
      capabilities,
      special_instructions,
    } = await req.json();

    if (!business_name) {
      return errorResponse('business_name is required.', 400);
    }

    console.log(`[generate-agent-prompt] Generating prompt for: ${business_name}`);

    const systemInstruction = `You are an expert at writing system prompts for AI phone receptionist agents.
Your output must be ONLY the system prompt text — no preamble, no markdown fences, no explanation.

The prompt you generate will be fed directly into a Retell AI voice agent that answers phone calls on behalf of a business.
The agent needs clear instructions on:
1. Who it is (name, role)
2. What company it represents (name, services, location, hours)
3. How to behave (tone, style, boundaries)
4. What it can do (check availability, book meetings, transfer calls, send SMS — only if enabled)
5. What it should NEVER do (make up pricing, guarantee timelines, provide legal/medical advice, reveal it is AI unless asked directly)
6. How to handle common scenarios (new inquiries, existing client questions, urgent requests, after-hours calls)

Write in second person ("You are...", "Your role is...").
Be specific and actionable. Avoid vague filler.
Keep it between 300-600 words.`;

    const capabilityLines: string[] = [];
    if (capabilities?.can_check_availability) capabilityLines.push('- Can check Google Calendar availability for open time slots');
    if (capabilities?.can_book_meetings) capabilityLines.push('- Can book meetings/appointments on the calendar');
    if (capabilities?.can_transfer_calls) capabilityLines.push('- Can transfer calls to a live team member');
    if (capabilities?.can_send_sms) capabilityLines.push('- Can send SMS text confirmations to callers');
    if (capabilityLines.length === 0) capabilityLines.push('- Informational only — take messages and answer questions');

    const prompt = `Generate a system prompt for an AI phone receptionist agent with the following details:

Business Name: ${business_name}
Industry/Type: ${industry || 'General business'}
Services Offered: ${services || 'Not specified'}
Agent Name: ${agent_name || 'AI Assistant'}
Business Phone: ${phone_number || 'Not specified'}
Location/Service Area: ${location || 'Not specified'}
Business Hours: ${business_hours_summary || 'Standard business hours'}
Desired Tone: ${tone || 'Professional and friendly'}

Enabled Capabilities:
${capabilityLines.join('\n')}

Special Instructions: ${special_instructions || 'None'}

Generate the system prompt now:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 1500,
      },
    });

    const generatedPrompt = response.text?.trim();

    if (!generatedPrompt) {
      return errorResponse('AI returned empty content.', 500);
    }

    console.log('[generate-agent-prompt] Success');
    return jsonResponse({ success: true, prompt: generatedPrompt });

  } catch (error: any) {
    console.error('[generate-agent-prompt] Error:', error.message);
    return errorResponse(error.message || 'Prompt generation failed.', 500);
  }
});
