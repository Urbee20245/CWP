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
  console.error(`[update-a2p-status] Error: ${message}`);
  return jsonResponse({ error: message }, status);
}

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