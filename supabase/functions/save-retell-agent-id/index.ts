import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, retell_agent_id, number_source } = await req.json();

    if (!client_id || !retell_agent_id) {
      return errorResponse('Missing required fields: client_id or retell_agent_id.', 400);
    }

    console.log(`[save-retell-agent-id] Saving agent ID ${retell_agent_id} for client ${client_id}`);

    // Check if a record already exists — preserve a2p_status and registration data
    const { data: existing } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('a2p_status, a2p_registration_data, voice_status')
        .eq('client_id', client_id)
        .maybeSingle();

    const payload: any = {
        client_id,
        retell_agent_id,
    };

    // Only set number_source if provided
    if (number_source) {
        payload.number_source = number_source;
    }

    // For new records, set defaults. For existing records, preserve a2p_status.
    if (!existing) {
        payload.voice_status = 'inactive';
        payload.a2p_status = 'not_started';
    }
    // If voice was previously failed, reset to inactive so they can retry
    if (existing?.voice_status === 'failed') {
        payload.voice_status = 'inactive';
    }

    const { error: upsertError } = await supabaseAdmin
        .from('client_voice_integrations')
        .upsert(payload, { onConflict: 'client_id' });

    if (upsertError) {
        console.error('[save-retell-agent-id] DB upsert failed:', upsertError);
        return errorResponse(`Database update failed: ${upsertError.message}`, 500);
    }

    console.log('[save-retell-agent-id] Agent ID saved successfully.');
    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[save-retell-agent-id] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
