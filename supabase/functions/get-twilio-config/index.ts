import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing token' }), { status: 401, headers: corsHeaders });
  }

  // Use the user's token to verify identity
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Initialize Admin client for sensitive data access
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id } = await req.json();
    if (!client_id) {
        return new Response(JSON.stringify({ error: 'Client ID is required' }), { status: 400, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("[get-twilio-config] Auth error:", authError);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: corsHeaders });
    }

    // Verify ownership via RLS-enabled query
    const { data: client, error: clientError } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .single();

    if (clientError || !client) {
        return new Response(JSON.stringify({ error: 'Forbidden: Access denied' }), { status: 403, headers: corsHeaders });
    }

    const { data: config, error: configError } = await supabaseAdmin
        .from('client_integrations')
        .select('account_sid_encrypted, phone_number, updated_at')
        .eq('client_id', client_id)
        .eq('provider', 'twilio')
        .maybeSingle();

    if (configError) throw configError;

    if (!config) {
        return new Response(JSON.stringify({ configured: false }), { status: 200, headers: corsHeaders });
    }

    const encryptedSid = config.account_sid_encrypted;
    const maskedSid = encryptedSid.substring(encryptedSid.length - 4);

    // connection_method may not exist if migration hasn't been run yet
    const connectionMethod = (config as any).connection_method || 'manual';

    return new Response(JSON.stringify({
        configured: true,
        phone_number: config.phone_number,
        masked_sid: maskedSid,
        updated_at: config.updated_at,
        connection_method: connectionMethod,
    }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error('[get-twilio-config] Crash:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});