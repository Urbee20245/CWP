import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role key for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, retell_agent_id, number_source } = await req.json();

    if (!client_id || !retell_agent_id || !number_source) {
      return errorResponse('Missing required fields: client_id, retell_agent_id, or number_source.', 400);
    }
    
    console.log(`[save-retell-agent-id] Saving agent ID ${retell_agent_id} for client ${client_id}`);

    // Use upsert on client_id (assuming client_id is unique for this integration)
    // We set voice_status and a2p_status to initial values on save, as provisioning is the next step.
    const payload = {
        client_id: client_id,
        retell_agent_id: retell_agent_id,
        number_source: number_source,
        voice_status: 'inactive', // Always reset to inactive on agent ID change/save
        a2p_status: 'not_started', // Reset A2P status if agent ID changes (optional, but safer)
    };

    // Use upsert on the unique client_id column
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