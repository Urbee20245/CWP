import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { encryptSecret } from '../_shared/encryption.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { data: client, error: clientError } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .single();
        
    if (clientError || !client) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const accountSidEncrypted = await encryptSecret(account_sid);
    const authTokenEncrypted = await encryptSecret(auth_token);

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

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error('[save-twilio-credentials] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});