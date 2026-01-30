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
  console.error(`[submit-a2p-registration] Error: ${message}`);
  return jsonRes({ error: message }, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errRes('Unauthorized: Missing authorization token.', 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, a2p_registration_data } = await req.json();

    if (!client_id || !a2p_registration_data) {
      return errRes('Missing required fields: client_id or a2p_registration_data.', 400);
    }

    // Verify the user owns this client
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errRes('Unauthorized: User not authenticated.', 401);
    }

    const { error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_profile_id', user.id)
        .single();

    if (clientError) {
        return errRes('Client record not found or unauthorized.', 403);
    }

    console.log(`[submit-a2p-registration] Submitting A2P data for client ${client_id}`);

    // Check if record exists to determine if we should block resubmission
    const { data: existing } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('a2p_status')
        .eq('client_id', client_id)
        .maybeSingle();

    // Block resubmission if already approved
    if (existing?.a2p_status === 'approved') {
        return errRes('A2P registration is already approved. No changes allowed.', 400);
    }

    const { error: upsertError } = await supabaseAdmin
        .from('client_voice_integrations')
        .upsert({
            client_id,
            a2p_registration_data,
            a2p_status: 'pending_approval',
            number_source: 'platform',
        }, { onConflict: 'client_id' });

    if (upsertError) {
        console.error('[submit-a2p-registration] DB upsert failed:', upsertError);
        return errRes(`Failed to save registration data: ${upsertError.message}`, 500);
    }

    console.log('[submit-a2p-registration] A2P registration submitted successfully.');
    return jsonRes({ success: true });

  } catch (error: any) {
    console.error('[submit-a2p-registration] Unhandled error:', error.message);
    return errRes(error.message, 500);
  }
});
