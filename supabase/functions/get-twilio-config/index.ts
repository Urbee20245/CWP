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
  console.error(`[get-twilio-config] Error: ${message}`);
  return jsonResponse({ error: message }, status);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('Unauthorized: Missing token', 401);
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
        return errorResponse('Client ID is required', 400);
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("[get-twilio-config] Auth error:", authError);
      return errorResponse('Unauthorized: Invalid token', 401);
    }

    // Verify ownership via RLS-enabled query
    const { data: client, error: clientError } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_profile_id', user.id)
        .single();

    if (clientError || !client) {
        return errorResponse('Forbidden: Access denied', 403);
    }

    const { data: config, error: configError } = await supabaseAdmin
        .from('client_integrations')
        .select('account_sid_encrypted, phone_number, updated_at')
        .eq('client_id', client_id)
        .eq('provider', 'twilio')
        .maybeSingle();

    if (configError) throw configError;
    
    if (!config) {
        return jsonResponse({ configured: false });
    }
    
    const encryptedSid = config.account_sid_encrypted;
    const maskedSid = encryptedSid.substring(encryptedSid.length - 4);

    return jsonResponse({ 
        configured: true,
        phone_number: config.phone_number,
        masked_sid: maskedSid,
        updated_at: config.updated_at,
    });

  } catch (error: any) {
    console.error('[get-twilio-config] Crash:', error.message);
    return errorResponse(error.message, 500);
  }
});