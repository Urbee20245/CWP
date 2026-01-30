import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import twilio from 'https://esm.sh/twilio@5.2.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
}

function jsonResponse(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function errorResponse(message: string, status: number = 500) {
  console.error(`[test-twilio-connection] Error: ${message}`);
  return jsonResponse({ error: message }, status);
}

// --- Inlined Encryption ---
const ENCRYPTION_KEY = Deno.env.get('SMTP_ENCRYPTION_KEY');

async function decryptSecret(supabaseAdmin: any, ciphertext: string): Promise<string> {
    if (!ENCRYPTION_KEY) throw new Error("Encryption key is missing.");
    const { data, error } = await supabaseAdmin.rpc('decrypt_secret', {
        ciphertext,
        key: ENCRYPTION_KEY,
    });
    if (error) throw new Error('Decryption failed.');
    return data as string;
}
// --- End Inlined Encryption ---

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Get authorization header
  const authHeader = req.headers.get('Authorization');
  console.log('[test-twilio-connection] Auth header present:', !!authHeader);

  if (!authHeader) {
    console.error('[test-twilio-connection] Missing Authorization header');
    return errorResponse('Unauthorized: Missing authorization token.', 401);
  }

  // Initialize Supabase client with RLS checks (public client)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  
  // Initialize Supabase Admin client for privileged decryption
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse('Client ID is required.', 400);
    }
    
    // 1. Verify user identity and ownership (using RLS/Auth context)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse('Unauthorized: User not authenticated.', 401);
    }
    
    const { error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_profile_id', user.id)
        .single();
        
    if (clientError) {
        return errorResponse('Client record not found or unauthorized.', 403);
    }

    // 2. Fetch encrypted credentials (using Admin client to bypass RLS for decryption)
    const { data: config, error: configError } = await supabaseAdmin
        .from('client_integrations')
        .select('account_sid_encrypted, auth_token_encrypted, phone_number')
        .eq('client_id', client_id)
        .eq('provider', 'twilio')
        .maybeSingle();

    if (configError || !config) {
        return jsonResponse({ success: false, message: 'Configuration not found. Please save credentials first.' });
    }
    
    // 3. Decrypt credentials
    const accountSid = await decryptSecret(supabaseAdmin, config.account_sid_encrypted);
    const authToken = await decryptSecret(supabaseAdmin, config.auth_token_encrypted);
    const phoneNumber = config.phone_number;

    if (!accountSid || !authToken || !phoneNumber) {
        return jsonResponse({ success: false, message: 'Decryption failed or phone number missing.' });
    }

    console.log(`[test-twilio-connection] Testing connection for SID: ${accountSid.substring(0, 4)}...`);

    // 4. Test Connection via Twilio API
    const twilioClient = twilio(accountSid, authToken);
    
    // Test 1: Fetch account details (basic credential validation)
    try {
        await twilioClient.api.v2010.accounts(accountSid).fetch();
    } catch (e: any) {
        console.error('[test-twilio-connection] Twilio Auth Failed:', e.message);
        return jsonResponse({ success: false, message: 'Authentication failed. Check Account SID and Auth Token.' });
    }
    
    // Test 2: Verify phone number exists in the account
    try {
        const incomingPhoneNumbers = await twilioClient.incomingPhoneNumbers.list({ phoneNumber: phoneNumber });
        if (incomingPhoneNumbers.length === 0) {
            return jsonResponse({ success: false, message: `Phone number ${phoneNumber} not found in your Twilio account.` });
        }
    } catch (e: any) {
        console.error('[test-twilio-connection] Twilio Phone Lookup Failed:', e.message);
        return jsonResponse({ success: false, message: 'Phone number validation failed. Ensure E.164 format (+1...) and ownership.' });
    }

    return jsonResponse({ success: true, message: 'Connection successful! Credentials and phone number verified.' });

  } catch (error: any) {
    console.error('[test-twilio-connection] Unhandled error:', error.message);
    return errorResponse('Internal server error during connection test.', 500);
  }
});