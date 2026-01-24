import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { decryptSecret } from '../_shared/encryption.ts';

const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
const PLATFORM_TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const PLATFORM_TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const RETELL_AGENT_ID = Deno.env.get('RETELL_AGENT_ID') || 'default-agent-id';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, source, phone_number, a2p_data } = await req.json();

    if (!client_id || !source) {
      return errorResponse('Missing required fields: client_id and source.', 400);
    }

    console.log(`[provision-voice-number] Sourcing ${source} number for client ${client_id}`);

    let twilio_sid = "";
    let twilio_token = "";
    let final_phone = phone_number;

    // 1. GATHER CREDENTIALS
    if (source === 'client') {
        const { data: config, error: configError } = await supabaseAdmin
            .from('client_integrations')
            .select('account_sid_encrypted, auth_token_encrypted, phone_number')
            .eq('client_id', client_id)
            .eq('provider', 'twilio')
            .maybeSingle();

        if (configError || !config) return errorResponse('Client Twilio credentials not found.', 404);
        
        twilio_sid = await decryptSecret(config.account_sid_encrypted);
        twilio_token = await decryptSecret(config.auth_token_encrypted);
        final_phone = config.phone_number;
    } else {
        // Platform Mode
        if (!PLATFORM_TWILIO_SID || !PLATFORM_TWILIO_TOKEN) {
            return errorResponse('Platform Twilio credentials not configured in secrets.', 500);
        }
        twilio_sid = PLATFORM_TWILIO_SID;
        twilio_token = PLATFORM_TWILIO_TOKEN;
    }

    if (!twilio_sid || !twilio_token || !final_phone) {
        return errorResponse('Incomplete credentials for provisioning.', 400);
    }

    // 2. IDEMPOTENCY CHECK
    const { data: existing } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('retell_phone_id, voice_status')
        .eq('client_id', client_id)
        .maybeSingle();

    if (existing?.voice_status === 'active') {
        return jsonResponse({ success: true, retell_phone_id: existing.retell_phone_id, message: "Already active." });
    }

    // 3. CALL RETELL API (using fetch to avoid SDK bundle issues)
    console.log(`[provision-voice-number] Importing ${final_phone} into Retell...`);
    const retellResponse = await fetch('https://api.retellai.com/create-phone-number', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RETELL_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            twilio_account_sid: twilio_sid,
            twilio_auth_token: twilio_token,
            phone_number: final_phone,
            agent_id: RETELL_AGENT_ID,
        }),
    });

    const retellData = await retellResponse.json();

    if (!retellResponse.ok) {
        console.error('[provision-voice-number] Retell Error:', retellData);
        
        await supabaseAdmin.from('client_voice_integrations').upsert({
            client_id,
            voice_status: 'failed',
            number_source: source,
            phone_number: final_phone
        }, { onConflict: 'client_id' });

        return errorResponse(`Retell Error: ${retellData.error?.message || 'Failed to import number'}`, 400);
    }

    // 4. SAVE RESULT
    const { error: dbError } = await supabaseAdmin
        .from('client_voice_integrations')
        .upsert({
            client_id,
            retell_phone_id: retellData.phone_number_id,
            phone_number: final_phone,
            number_source: source,
            voice_status: 'active',
            a2p_registration_data: a2p_data || {},
            a2p_status: source === 'platform' ? 'pending' : 'none'
        }, { onConflict: 'client_id' });

    if (dbError) return errorResponse('Provisioned in Retell but failed to update local DB.', 500);

    return jsonResponse({ success: true, retell_phone_id: retellData.phone_number_id });

  } catch (error: any) {
    console.error('[provision-voice-number] Crash:', error.message);
    return errorResponse(error.message, 500);
  }
});