import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { decryptSecret } from '../_shared/encryption.ts';

const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
const PLATFORM_TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const PLATFORM_TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, source, phone_number, a2p_data, retell_agent_id } = await req.json();

    if (!client_id || !source) {
      return errorResponse('Missing required fields: client_id and source.', 400);
    }

    // CRITICAL: Check Retell API Key first
    if (!RETELL_API_KEY) {
      console.error('[provision-voice-number] RETELL_API_KEY is not configured in Supabase secrets.');
      return errorResponse('Retell API Key is not configured. Please add RETELL_API_KEY to Supabase secrets.', 500);
    }

    // Check per-client Retell Agent ID
    if (!retell_agent_id) {
      console.error('[provision-voice-number] No Retell Agent ID provided for this client.');
      return errorResponse('Please enter the Retell Agent ID for this client before enabling AI call handling.', 400);
    }

    console.log(`[provision-voice-number] Sourcing ${source} number for client ${client_id} with agent ${retell_agent_id}`);

    let twilio_sid = "";
    let twilio_token = "";
    let final_phone = phone_number;
    let a2p_status = 'not_started'; // Default status

    // 1. GATHER CREDENTIALS AND A2P STATUS
    const { data: voiceConfig, error: voiceConfigError } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('retell_phone_id, voice_status, a2p_registration_data, a2p_status')
        .eq('client_id', client_id)
        .maybeSingle();
        
    if (voiceConfigError) {
        console.error('[provision-voice-number] Error fetching voice config:', voiceConfigError);
    }
    
    if (voiceConfig) {
        a2p_status = voiceConfig.a2p_status || 'not_started';
    }

    if (source === 'client') {
        const { data: config, error: configError } = await supabaseAdmin
            .from('client_integrations')
            .select('account_sid_encrypted, auth_token_encrypted, phone_number')
            .eq('client_id', client_id)
            .eq('provider', 'twilio')
            .maybeSingle();

        if (configError) {
            console.error('[provision-voice-number] Error fetching client credentials:', configError);
            return errorResponse('Error fetching client Twilio credentials from database.', 500);
        }

        if (!config) {
            return errorResponse('Client has not configured their Twilio credentials yet. Please ask the client to enter their Twilio Account SID, Auth Token, and Phone Number in their Settings page.', 404);
        }
        
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
    
    // 2. A2P STATUS CHECK (STRICT REQUIREMENT)
    if (source === 'client') {
        console.log(`[provision-voice-number] Client-owned number detected. A2P Status: ${a2p_status}`);
        if (a2p_status !== 'approved') {
            console.warn('[provision-voice-number] Provisioning skipped: A2P status is not approved.');
            return jsonResponse({
                status: "pending_a2p",
                message: "A2P approval is required before activating AI calls for client-owned numbers.",
            }, 422); // 422 Unprocessable Entity
        }
    } else {
        console.log('[provision-voice-number] Platform-owned number detected. Skipping A2P check.');
    }

    // 3. IDEMPOTENCY CHECK
    if (voiceConfig?.voice_status === 'active') {
        console.log('[provision-voice-number] Already active. Skipping Retell call.');
        return jsonResponse({ success: true, retell_phone_id: voiceConfig.retell_phone_id, message: "Already active." });
    }

    // 4. CALL RETELL API
    console.log(`[provision-voice-number] Importing ${final_phone} into Retell with agent ${retell_agent_id}...`);
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
            agent_id: retell_agent_id, // Per-client agent ID
        }),
    });

    const retellData = await retellResponse.json();

    if (!retellResponse.ok) {
        console.error('[provision-voice-number] Retell Error:', retellData);

        // Update DB status to failed
        await supabaseAdmin.from('client_voice_integrations').upsert({
            client_id,
            voice_status: 'failed',
            number_source: source,
            phone_number: final_phone
        }, { onConflict: 'client_id' });

        // Provide more specific error messages based on Retell response
        let errorMessage = 'Failed to import number to Retell AI.';
        if (retellData.error?.message) {
            errorMessage = `Retell Error: ${retellData.error.message}`;
        } else if (retellData.message) {
            errorMessage = `Retell Error: ${retellData.message}`;
        } else if (retellData.detail) {
            errorMessage = `Retell Error: ${retellData.detail}`;
        } else if (retellResponse.status === 401) {
            errorMessage = 'Retell API authentication failed. Please verify RETELL_API_KEY is correct.';
        } else if (retellResponse.status === 400) {
            errorMessage = 'Invalid request to Retell. Please verify the Twilio credentials and phone number are correct.';
        }

        return errorResponse(errorMessage, 400);
    }

    // 5. SAVE RESULT
    const { error: dbError } = await supabaseAdmin
        .from('client_voice_integrations')
        .upsert({
            client_id,
            retell_phone_id: retellData.phone_number_id,
            phone_number: final_phone,
            number_source: source,
            voice_status: 'active',
            a2p_registration_data: a2p_data || voiceConfig?.a2p_registration_data || {},
            a2p_status: source === 'platform' ? 'pending' : a2p_status // Keep existing A2P status if client-owned
        }, { onConflict: 'client_id' });

    if (dbError) return errorResponse('Provisioned in Retell but failed to update local DB.', 500);

    console.log(`[provision-voice-number] Successful provisioning. Retell ID: ${retellData.phone_number_id}`);
    return jsonResponse({ success: true, retell_phone_id: retellData.phone_number_id });

  } catch (error: any) {
    console.error('[provision-voice-number] Crash:', error.message);
    return errorResponse(error.message, 500);
  }
});