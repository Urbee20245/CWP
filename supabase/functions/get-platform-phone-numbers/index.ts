import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch platform-owned phone numbers from Twilio or DB
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ phone_numbers: [] }), { status: 200, headers: corsHeaders });
    }

    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=50`,
      { headers: { 'Authorization': `Basic ${credentials}` } }
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ phone_numbers: [] }), { status: 200, headers: corsHeaders });
    }

    const data = await res.json();
    const numbers = (data.incoming_phone_numbers || []).map((n: any) => ({
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      sid: n.sid,
    }));

    return new Response(JSON.stringify({ phone_numbers: numbers }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('[get-platform-phone-numbers]', err.message);
    return new Response(JSON.stringify({ phone_numbers: [] }), { status: 200, headers: corsHeaders });
  }
});
