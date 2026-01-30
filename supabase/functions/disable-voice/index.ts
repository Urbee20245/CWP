import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse('Missing required field: client_id.', 400);
    }

    console.log(`[disable-voice] Disabling voice for client ${client_id}`);

    // Get current voice config
    const { data: voiceConfig, error: fetchError } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('retell_phone_id, voice_status, phone_number')
        .eq('client_id', client_id)
        .maybeSingle();

    if (fetchError) {
        console.error('[disable-voice] Error fetching voice config:', fetchError);
        return errorResponse('Failed to fetch voice configuration.', 500);
    }

    if (!voiceConfig || voiceConfig.voice_status !== 'active') {
        return errorResponse('Voice is not currently active for this client.', 400);
    }

    // Attempt to delete the phone number from Retell if we have the ID
    if (voiceConfig.retell_phone_id && RETELL_API_KEY) {
        try {
            console.log(`[disable-voice] Deleting Retell phone ${voiceConfig.retell_phone_id}...`);
            const retellResponse = await fetch(`https://api.retellai.com/delete-phone-number/${voiceConfig.retell_phone_id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${RETELL_API_KEY}`,
                },
            });

            if (!retellResponse.ok) {
                const retellError = await retellResponse.text();
                console.warn(`[disable-voice] Retell delete returned ${retellResponse.status}: ${retellError}`);
                // Continue anyway — we still want to mark as inactive in our DB
            } else {
                console.log('[disable-voice] Retell phone number deleted successfully.');
            }
        } catch (retellErr: any) {
            console.warn('[disable-voice] Retell API call failed (continuing):', retellErr.message);
        }
    }

    // Update DB to inactive
    const { error: updateError } = await supabaseAdmin
        .from('client_voice_integrations')
        .update({
            voice_status: 'inactive',
            retell_phone_id: null,
        })
        .eq('client_id', client_id);

    if (updateError) {
        console.error('[disable-voice] DB update failed:', updateError);
        return errorResponse(`Database update failed: ${updateError.message}`, 500);
    }

    console.log('[disable-voice] Voice disabled successfully.');
    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[disable-voice] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
