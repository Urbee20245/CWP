import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Shared utilities (inlined)
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
  console.error(`[save-twilio-credentials] Error: ${message}`);
  return jsonResponse({ error: message }, status);
}

// Encryption function (inlined)
const ENCRYPTION_KEY = Deno.env.get('SMTP_ENCRYPTION_KEY');

async function encryptSecret(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    throw new Error("SMTP_ENCRYPTION_KEY environment variable is missing.");
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabaseAdmin.rpc('encrypt_secret', {
    plaintext: plaintext,
    key: ENCRYPTION_KEY,
  });

  if (error) {
    console.error("[encryption] Encryption failed:", error);
    throw new Error("Encryption failed.");
  }
  return data as string;
}

// Main handler
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with RLS checks (public client)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  // Initialize Supabase Admin client for privileged updates
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, account_sid, auth_token, phone_number } = await req.json();

    if (!client_id || !account_sid || !auth_token || !phone_number) {
      return errorResponse('Missing required fields.', 400);
    }

    // 1. Verify user identity and ownership (using RLS/Auth context)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse('Unauthorized: User not authenticated.', 401);
    }

    // Use RLS to ensure the user owns the client record
    const { error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_profile_id', user.id)
        .single();

    if (clientError) {
        return errorResponse('Client record not found or unauthorized.', 403);
    }

    console.log(`[save-twilio-credentials] Encrypting and saving credentials for client ${client_id}`);

    // 2. Encrypt sensitive data
    let accountSidEncrypted, authTokenEncrypted;
    try {
        accountSidEncrypted = await encryptSecret(account_sid);
        authTokenEncrypted = await encryptSecret(auth_token);
        console.log('[save-twilio-credentials] Encryption successful');
    } catch (encryptError: any) {
        console.error('[save-twilio-credentials] Encryption failed:', encryptError);
        return errorResponse(`Encryption failed: ${encryptError.message}`, 500);
    }

    // 3. Upsert (Insert or Update) the record using the Admin client
    console.log('[save-twilio-credentials] Attempting to upsert into client_integrations...');
    const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from('client_integrations')
        .upsert({
            client_id: client_id,
            provider: 'twilio',
            account_sid_encrypted: accountSidEncrypted,
            auth_token_encrypted: authTokenEncrypted,
            phone_number: phone_number,
        }, { onConflict: 'client_id,provider' })
        .select();

    if (upsertError) {
        console.error('[save-twilio-credentials] Upsert failed:', upsertError);
        return errorResponse(`Failed to save credentials: ${upsertError.message}`, 500);
    }

    console.log('[save-twilio-credentials] Credentials saved successfully:', upsertData);
    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[save-twilio-credentials] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
