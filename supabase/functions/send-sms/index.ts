import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import twilio from 'https://esm.sh/twilio@5.2.0?target=deno';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.error("[send-sms] Twilio secrets are missing.");
  // Note: We return a 500 error if secrets are missing to prevent silent failures.
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return errorResponse("Twilio service is not configured. Missing secrets.", 500);
  }

  try {
    const { to, body } = await req.json();

    if (!to || !body) {
      return errorResponse('Recipient number ("to") and message body ("body") are required.', 400);
    }
    
    console.log(`[send-sms] Attempting to send SMS to: ${to}`);

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    const message = await client.messages.create({
      body: body,
      to: to,
      from: TWILIO_PHONE_NUMBER,
    });

    console.log(`[send-sms] Message sent successfully. SID: ${message.sid}`);
    return jsonResponse({ success: true, sid: message.sid });

  } catch (error: any) {
    console.error('[send-sms] Twilio API error:', error.message);
    return errorResponse(`Failed to send SMS: ${error.message}`, 500);
  }
});