import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function twimlResponse() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    }
  );
}

// Normalize a phone number to digits only for comparison
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Convert a digits-only number to E.164 (assumes US if 10 digits)
function toE164(digits: string): string {
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return `+${digits}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[twilio-sms-webhook] Supabase env vars missing.');
    return twimlResponse();
  }

  let formText: string;
  try {
    formText = await req.text();
  } catch (err: any) {
    console.error(`[twilio-sms-webhook] Failed to read request body: ${err.message}`);
    return twimlResponse();
  }

  // Parse URL-encoded form body from Twilio
  const params = new URLSearchParams(formText);
  const From = params.get('From') ?? '';
  const To = params.get('To') ?? '';
  const Body = params.get('Body') ?? '';
  const MessageSid = params.get('MessageSid') ?? '';
  const AccountSid = params.get('AccountSid') ?? '';

  console.log(`[twilio-sms-webhook] Inbound SMS from ${From} to ${To}, SID: ${MessageSid}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up client by phone number
  let clientId: string | null = null;
  try {
    const fromDigits = digitsOnly(From);
    const fromE164 = toE164(fromDigits);

    // Fetch clients and match locally to handle varied phone formats
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, phone');

    if (clientError) {
      console.error('[twilio-sms-webhook] Error querying clients:', clientError.message);
    } else if (clients) {
      const matched = (clients as Array<{ id: string; phone: string | null }>).find((c) => {
        if (!c.phone) return false;
        const storedDigits = digitsOnly(c.phone);
        const storedE164 = toE164(storedDigits);
        return storedDigits === fromDigits || storedE164 === fromE164;
      });
      if (matched) {
        clientId = matched.id;
        console.log(`[twilio-sms-webhook] Matched client_id: ${clientId}`);
      } else {
        console.warn(`[twilio-sms-webhook] No client found for phone: ${From}`);
      }
    }
  } catch (lookupErr: any) {
    console.error('[twilio-sms-webhook] Exception during client lookup:', lookupErr.message);
  }

  // Insert inbound message into sms_messages
  try {
    const { error: insertError } = await supabase.from('sms_messages').insert({
      client_id: clientId,
      direction: 'inbound',
      from_number: From,
      to_number: To,
      body: Body,
      status: 'received',
      twilio_message_sid: MessageSid,
      twilio_account_sid: AccountSid,
      received_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[twilio-sms-webhook] Failed to insert inbound message:', insertError.message);
    } else {
      console.log('[twilio-sms-webhook] Inbound message logged successfully.');
    }
  } catch (insertErr: any) {
    console.error('[twilio-sms-webhook] Exception inserting inbound message:', insertErr.message);
  }

  return twimlResponse();
});
