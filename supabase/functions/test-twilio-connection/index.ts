import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import twilio from 'https://esm.sh/twilio@5.2.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function errRes(message: string, status = 500) {
  console.error(`[test-twilio-connection] Error: ${message}`);
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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errRes('Unauthorized: Missing authorization token.', 401);
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

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errRes('Client ID is required.', 400);
    }

    // Verify user identity and ownership
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return errRes('Unauthorized: User not authenticated.', 401);
    }

    const { error: clientError } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('owner_profile_id', user.id)
      .single();

    if (clientError) {
      return errRes('Client record not found or unauthorized.', 403);
    }

    // Fetch encrypted credentials
    const { data: config, error: configError } = await supabaseAdmin
      .from('client_integrations')
      .select('account_sid_encrypted, auth_token_encrypted, phone_number, connection_method')
      .eq('client_id', client_id)
      .eq('provider', 'twilio')
      .maybeSingle();

    if (configError || !config) {
      return jsonRes({ success: false, message: 'Configuration not found. Please save credentials first.' });
    }

    // Decrypt the account SID
    const accountSid = await decryptSecret(supabaseAdmin, config.account_sid_encrypted);
    const phoneNumber = config.phone_number;

    if (!accountSid || !phoneNumber) {
      return jsonRes({ success: false, message: 'Account SID or phone number missing.' });
    }

    // Determine which credentials to use for testing
    let testSid: string;
    let testToken: string;

    if (config.connection_method === 'twilio_connect') {
      // For Connect accounts, use platform credentials to access connected account
      if (!PLATFORM_TWILIO_SID || !PLATFORM_TWILIO_TOKEN) {
        return jsonRes({ success: false, message: 'Platform Twilio credentials not configured for Connect test.' });
      }
      testSid = PLATFORM_TWILIO_SID;
      testToken = PLATFORM_TWILIO_TOKEN;
      console.log(`[test-twilio-connection] Testing Connect account ${accountSid.substring(0, 8)}... via platform credentials`);
    } else {
      // Manual: use client's own credentials
      testToken = await decryptSecret(supabaseAdmin, config.auth_token_encrypted);
      testSid = accountSid;
      console.log(`[test-twilio-connection] Testing manual credentials for SID: ${accountSid.substring(0, 8)}...`);
    }

    // Test 1: Fetch account details (basic credential validation)
    try {
      const twilioClient = twilio(testSid, testToken);
      await twilioClient.api.v2010.accounts(accountSid).fetch();
    } catch (e: any) {
      console.error('[test-twilio-connection] Twilio Auth Failed:', e.message);
      return jsonRes({ success: false, message: 'Authentication failed. Check Account SID and Auth Token.' });
    }

    // Test 2: Verify phone number exists in the account
    try {
      const twilioClient = twilio(testSid, testToken);
      const incomingPhoneNumbers = await twilioClient
        .api.v2010.accounts(accountSid)
        .incomingPhoneNumbers.list({ phoneNumber });

      if (incomingPhoneNumbers.length === 0) {
        return jsonRes({ success: false, message: `Phone number ${phoneNumber} not found in the Twilio account.` });
      }
    } catch (e: any) {
      console.error('[test-twilio-connection] Phone Lookup Failed:', e.message);
      return jsonRes({ success: false, message: 'Phone number validation failed. Ensure E.164 format (+1...) and ownership.' });
    }

    return jsonRes({ success: true, message: 'Connection successful! Credentials and phone number verified.' });

  } catch (error: any) {
    console.error('[test-twilio-connection] Crash:', error.message, error.stack);
    return errRes('Internal server error during connection test.', 500);
  }
});
