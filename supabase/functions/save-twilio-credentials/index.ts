import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

// --- Inlined Encryption ---
const ENCRYPTION_KEY = Deno.env.get('SMTP_ENCRYPTION_KEY');

async function encryptSecret(supabaseAdmin: any, plaintext: string): Promise<string> {
    if (!ENCRYPTION_KEY) throw new Error("Encryption key is missing.");
    const { data, error } = await supabaseAdmin.rpc('encrypt_secret', {
        plaintext,
        key: ENCRYPTION_KEY,
    });
    if (error) throw new Error('Encryption failed.');
    return data as string;
}
// --- End Inlined Encryption ---

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('Unauthorized: Missing token', 401);
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
    const { client_id, account_sid, auth_token, phone_number } = await req.json();

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return errorResponse('Unauthorized: Invalid token', 401);
    }

    // Verify ownership via RLS-enabled query
    const { error: clientError } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_profile_id', user.id)
        .single();
        
    if (clientError) {
        return errorResponse('Forbidden: Client record not found or unauthorized.', 403);
    }

    const accountSidEncrypted = await encryptSecret(supabaseAdmin, account_sid);
    const authTokenEncrypted = await encryptSecret(supabaseAdmin, auth_token);

    const { error: upsertError } = await supabaseAdmin
        .from('client_integrations')
        .upsert({
            client_id,
            provider: 'twilio',
            account_sid_encrypted: accountSidEncrypted,
            auth_token_encrypted: authTokenEncrypted,
            phone_number,
        }, { onConflict: 'client_id,provider' });

    if (upsertError) throw upsertError;

    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[save-twilio-credentials] Error:', error.message);
    return errorResponse(error.message, 500);
  }
});