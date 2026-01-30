import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function errRes(message: string, status = 500) {
  console.error(`[get-twilio-phone-numbers] Error: ${message}`);
  return jsonRes({ error: message }, status);
}

async function decryptSecret(supabaseAdmin: any, ciphertext: string): Promise<string> {
  const key = Deno.env.get('SMTP_ENCRYPTION_KEY');
  if (!key) throw new Error('SMTP_ENCRYPTION_KEY is not configured.');
  const { data, error } = await supabaseAdmin.rpc('decrypt_secret', { ciphertext, key });
  if (error) throw new Error('Failed to decrypt credentials.');
  return data as string;
}

const PLATFORM_TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const PLATFORM_TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errRes('Unauthorized.', 401);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return errRes('Unauthorized.', 401);
    }

    const { client_id } = await req.json();
    if (!client_id) {
      return errRes('client_id is required.', 400);
    }

    // Verify ownership
    const { error: clientError } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (clientError) {
      return errRes('Forbidden.', 403);
    }

    // Get stored credentials
    const { data: config, error: configError } = await supabaseAdmin
      .from('client_integrations')
      .select('account_sid_encrypted, auth_token_encrypted, phone_number')
      .eq('client_id', client_id)
      .eq('provider', 'twilio')
      .maybeSingle();

    if (configError || !config) {
      return errRes('Twilio not configured for this client.', 404);
    }

    const connectionMethod = (config as any).connection_method || 'manual';

    // Decrypt the account SID to use for Twilio API call
    const accountSid = await decryptSecret(supabaseAdmin, config.account_sid_encrypted);

    // Determine which credentials to use for the API call
    let apiSid: string;
    let apiToken: string;

    if (connectionMethod === 'twilio_connect') {
      // For Connect accounts, use platform credentials to access the connected account
      if (!PLATFORM_TWILIO_SID || !PLATFORM_TWILIO_TOKEN) {
        return errRes('Platform Twilio credentials not configured.', 500);
      }
      apiSid = PLATFORM_TWILIO_SID;
      apiToken = PLATFORM_TWILIO_TOKEN;
    } else {
      // For manually-entered credentials, use the client's own credentials
      apiSid = accountSid;
      apiToken = await decryptSecret(supabaseAdmin, config.auth_token_encrypted);
    }

    console.log(`[get-twilio-phone-numbers] Fetching numbers for account ${accountSid.substring(0, 8)}...`);

    const phoneResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=50`,
      {
        headers: {
          'Authorization': 'Basic ' + btoa(`${apiSid}:${apiToken}`),
        },
      }
    );

    if (!phoneResponse.ok) {
      const errText = await phoneResponse.text();
      console.error(`[get-twilio-phone-numbers] Twilio API error (${phoneResponse.status}): ${errText}`);
      return errRes(`Failed to fetch phone numbers from Twilio (${phoneResponse.status}).`, 400);
    }

    const phoneData = JSON.parse(await phoneResponse.text());
    const phoneNumbers = (phoneData.incoming_phone_numbers || []).map((n: any) => ({
      sid: n.sid,
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      capabilities: n.capabilities,
    }));

    console.log(`[get-twilio-phone-numbers] Found ${phoneNumbers.length} numbers`);

    return jsonRes({
      phone_numbers: phoneNumbers,
      selected_phone: config.phone_number,
    });

  } catch (error: any) {
    console.error('[get-twilio-phone-numbers] Crash:', error.message);
    return errRes(error.message, 500);
  }
});
