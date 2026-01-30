import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('Unauthorized: Missing authorization token.', 401);
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
      return errorResponse('Missing required fields: client_id or a2p_registration_data.', 400);
    }

    // Verify the user owns this client
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

    console.log(`[submit-a2p-registration] Submitting A2P data for client ${client_id}`);

    // Check if record exists to determine if we should block resubmission
    const { data: existing } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('a2p_status')
        .eq('client_id', client_id)
        .maybeSingle();

    // Block resubmission if already approved
    if (existing?.a2p_status === 'approved') {
        return errorResponse('A2P registration is already approved. No changes allowed.', 400);
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
        return errorResponse(`Failed to save registration data: ${upsertError.message}`, 500);
    }

    console.log('[submit-a2p-registration] A2P registration submitted successfully.');
    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[submit-a2p-registration] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
