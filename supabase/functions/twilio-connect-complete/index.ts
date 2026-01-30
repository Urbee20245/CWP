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
  console.error(`[twilio-connect-complete] Error: ${message}`);
  return jsonRes({ error: message }, status);
}

async function encryptSecret(supabaseAdmin: any, plaintext: string): Promise<string> {
  const key = Deno.env.get('SMTP_ENCRYPTION_KEY');
  if (!key) throw new Error('SMTP_ENCRYPTION_KEY is not configured.');
  const { data, error } = await supabaseAdmin.rpc('encrypt_secret', { plaintext, key });
  if (error) {
    console.error('[twilio-connect-complete] Encryption failed:', error);
    throw new Error('Failed to encrypt credentials.');
  }
  return data as string;
}

const PLATFORM_TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const PLATFORM_TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the calling user is authenticated
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return errRes('Unauthorized: Invalid token.', 401);
    }

    const { client_id, twilio_account_sid } = await req.json();

    if (!client_id || !twilio_account_sid) {
      return errRes('Missing required fields: client_id and twilio_account_sid.', 400);
    }

    console.log(`[twilio-connect-complete] Processing Connect for client ${client_id}, Twilio account ${twilio_account_sid.substring(0, 8)}...`);

    // Verify the user owns this client (RLS check)
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return errRes('Forbidden: You do not own this client record.', 403);
    }

    // Verify platform Twilio credentials are configured
    if (!PLATFORM_TWILIO_SID || !PLATFORM_TWILIO_TOKEN) {
      return errRes('Platform Twilio credentials not configured. Admin must set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Supabase secrets.', 500);
    }

    // Step 1: Use Connect access to fetch the connected account details
    // With Twilio Connect, the platform can access the authorized account
    console.log('[twilio-connect-complete] Fetching connected account details...');

    const accountResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}.json`,
      {
        headers: {
          'Authorization': 'Basic ' + btoa(`${PLATFORM_TWILIO_SID}:${PLATFORM_TWILIO_TOKEN}`),
        },
      }
    );

    const accountText = await accountResponse.text();
    console.log(`[twilio-connect-complete] Account fetch status: ${accountResponse.status}`);

    if (!accountResponse.ok) {
      console.error(`[twilio-connect-complete] Failed to fetch account: ${accountText}`);
      return errRes(`Failed to access Twilio account. Status ${accountResponse.status}. Ensure the Connect app is properly authorized.`, 400);
    }

    let accountData: any;
    try {
      accountData = JSON.parse(accountText);
    } catch {
      return errRes('Invalid response from Twilio API.', 500);
    }

    const connectedAuthToken = accountData.auth_token;
    if (!connectedAuthToken) {
      console.error('[twilio-connect-complete] No auth_token in account response');
      return errRes('Could not retrieve auth token from connected account. The Connect authorization may need to be re-done.', 400);
    }

    console.log(`[twilio-connect-complete] Got auth token for account ${twilio_account_sid.substring(0, 8)}...`);

    // Step 2: List phone numbers from the connected account
    console.log('[twilio-connect-complete] Fetching phone numbers...');

    const phoneResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/IncomingPhoneNumbers.json?PageSize=50`,
      {
        headers: {
          'Authorization': 'Basic ' + btoa(`${PLATFORM_TWILIO_SID}:${PLATFORM_TWILIO_TOKEN}`),
        },
      }
    );

    let phoneNumbers: any[] = [];
    if (phoneResponse.ok) {
      const phoneData = JSON.parse(await phoneResponse.text());
      phoneNumbers = (phoneData.incoming_phone_numbers || []).map((n: any) => ({
        sid: n.sid,
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        capabilities: n.capabilities,
      }));
      console.log(`[twilio-connect-complete] Found ${phoneNumbers.length} phone numbers`);
    } else {
      console.warn(`[twilio-connect-complete] Phone number fetch failed (${phoneResponse.status}), continuing without numbers`);
    }

    // Step 3: Encrypt and store credentials
    console.log('[twilio-connect-complete] Encrypting and storing credentials...');

    const encryptedSid = await encryptSecret(supabaseAdmin, twilio_account_sid);
    const encryptedToken = await encryptSecret(supabaseAdmin, connectedAuthToken);

    // Pick the first phone number as default if available
    const defaultPhone = phoneNumbers.length > 0 ? phoneNumbers[0].phone_number : null;

    const upsertPayload: any = {
      client_id,
      provider: 'twilio',
      account_sid_encrypted: encryptedSid,
      auth_token_encrypted: encryptedToken,
      phone_number: defaultPhone,
    };

    // First try with connection_method (requires migration 20260131)
    let upsertError: any = null;
    const { error: err1 } = await supabaseAdmin
      .from('client_integrations')
      .upsert({ ...upsertPayload, connection_method: 'twilio_connect' }, { onConflict: 'client_id,provider' });

    if (err1 && err1.message?.includes('connection_method')) {
      // Column doesn't exist yet — retry without it
      console.warn('[twilio-connect-complete] connection_method column missing, retrying without it');
      const { error: err2 } = await supabaseAdmin
        .from('client_integrations')
        .upsert(upsertPayload, { onConflict: 'client_id,provider' });
      upsertError = err2;
    } else {
      upsertError = err1;
    }

    if (upsertError) {
      console.error('[twilio-connect-complete] DB upsert failed:', upsertError);
      return errRes(`Failed to store credentials: ${upsertError.message}`, 500);
    }

    console.log('[twilio-connect-complete] Credentials stored successfully.');

    return jsonRes({
      success: true,
      phone_numbers: phoneNumbers,
      selected_phone: defaultPhone,
      account_sid_masked: `...${twilio_account_sid.slice(-4)}`,
    });

  } catch (error: any) {
    console.error('[twilio-connect-complete] Crash:', error.message, error.stack);
    return errRes(error.message, 500);
  }
});
