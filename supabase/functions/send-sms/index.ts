import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import twilio from 'https://esm.sh/twilio@5.2.0?target=deno';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.error("[send-sms] Twilio secrets are missing.");
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return errorResponse("Twilio service is not configured. Missing secrets.", 500);
  }

  try {
    const { to, body, client_id } = await req.json();

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

    // Log the outbound message to sms_messages table
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { error: logError } = await supabase.from('sms_messages').insert({
          client_id: client_id || null,
          direction: 'outbound',
          from_number: TWILIO_PHONE_NUMBER,
          to_number: to,
          body: body,
          status: message.status,
          twilio_message_sid: message.sid,
          twilio_account_sid: TWILIO_ACCOUNT_SID,
        });
        if (logError) {
          console.error('[send-sms] Failed to log outbound message:', logError.message);
        } else {
          console.log('[send-sms] Outbound message logged to sms_messages.');
        }
      } catch (logErr: any) {
        console.error('[send-sms] Exception logging outbound message:', logErr.message);
      }
    } else {
      console.warn('[send-sms] Supabase env vars missing — outbound message not logged.');
    }

    return jsonResponse({ success: true, sid: message.sid });

  } catch (error: any) {
    console.error('[send-sms] Twilio API error:', error.message);
    return errorResponse(`Failed to send SMS: ${error.message}`, 500);
  }
});
