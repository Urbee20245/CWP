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
    const { client_id, a2p_status } = await req.json();

    if (!client_id || !a2p_status) {
      return errorResponse('Missing required fields: client_id or a2p_status.', 400);
    }

    const validStatuses = ['not_started', 'pending_approval', 'approved', 'rejected'];
    if (!validStatuses.includes(a2p_status)) {
      return errorResponse(`Invalid a2p_status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    console.log(`[update-a2p-status] Updating A2P status to '${a2p_status}' for client ${client_id}`);

    const { error: updateError } = await supabaseAdmin
        .from('client_voice_integrations')
        .update({ a2p_status })
        .eq('client_id', client_id);

    if (updateError) {
        console.error('[update-a2p-status] DB update failed:', updateError);
        return errorResponse(`Database update failed: ${updateError.message}`, 500);
    }

    console.log('[update-a2p-status] A2P status updated successfully.');
    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[update-a2p-status] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
