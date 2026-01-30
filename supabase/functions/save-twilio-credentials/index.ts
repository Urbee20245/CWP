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
  console.error(`[save-twilio-credentials] Error: ${message}`);
  return jsonRes({ error: message }, status);
}

async function encryptSecret(supabaseAdmin: any, plaintext: string): Promise<string> {
  const key = Deno.env.get('SMTP_ENCRYPTION_KEY');
  if (!key) throw new Error('SMTP_ENCRYPTION_KEY is not configured.');
  const { data, error } = await supabaseAdmin.rpc('encrypt_secret', { plaintext, key });
  if (error) {
    console.error('[save-twilio-credentials] Encryption failed:', error);
    throw new Error('Encryption failed.');
  }
  return data as string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errRes('Unauthorized', 401);
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
    const body = await req.json();
    const { client_id, account_sid, auth_token, phone_number, update_phone_only } = body;

    if (!client_id) {
      return errRes('client_id is required.', 400);
    }

    // Verify user identity and ownership
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return errRes('Unauthorized', 401);
    }

    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return errRes('Forbidden', 403);
    }

    // Phone-only update (used by phone number selector after Connect)
    if (update_phone_only) {
      if (!phone_number) {
        return errRes('phone_number is required for phone-only update.', 400);
      }

      console.log(`[save-twilio-credentials] Updating phone number only for client ${client_id}: ${phone_number}`);

      const { error: updateError } = await supabaseAdmin
        .from('client_integrations')
        .update({ phone_number })
        .eq('client_id', client_id)
        .eq('provider', 'twilio');

      if (updateError) {
        console.error('[save-twilio-credentials] Phone update failed:', updateError);
        return errRes(`Failed to update phone number: ${updateError.message}`, 500);
      }

      return jsonRes({ success: true });
    }

    // Full credential save (manual entry)
    if (!account_sid || !auth_token || !phone_number) {
      return errRes('account_sid, auth_token, and phone_number are all required.', 400);
    }

    console.log(`[save-twilio-credentials] Encrypting credentials for client ${client_id}...`);

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
        connection_method: 'manual',
      }, { onConflict: 'client_id,provider' });

    if (upsertError) {
      console.error('[save-twilio-credentials] Upsert failed:', upsertError);
      return errRes(`Failed to save credentials: ${upsertError.message}`, 500);
    }

    console.log('[save-twilio-credentials] Credentials saved successfully.');
    return jsonRes({ success: true });

  } catch (error: any) {
    console.error('[save-twilio-credentials] Crash:', error.message);
    return errRes(error.message, 500);
  }
});
