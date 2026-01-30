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
  console.error(`[provision-voice-number] Error: ${message}`);
  return jsonRes({ error: message }, status);
}

async function decryptSecret(supabaseAdmin: any, ciphertext: string): Promise<string> {
  const key = Deno.env.get('SMTP_ENCRYPTION_KEY');
  if (!key) throw new Error('SMTP_ENCRYPTION_KEY is not configured.');
  const { data, error } = await supabaseAdmin.rpc('decrypt_secret', { ciphertext, key });
  if (error) {
    console.error('[provision-voice-number] Decryption failed:', error);
    throw new Error('Failed to decrypt credentials.');
  }
  return data as string;
}

const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
const PLATFORM_TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const PLATFORM_TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, source, phone_number, a2p_data, retell_agent_id } = await req.json();

    if (!client_id || !source) {
      return errRes('Missing required fields: client_id and source.', 400);
    }

    if (!RETELL_API_KEY) {
      return errRes('Retell API Key is not configured. Please add RETELL_API_KEY to Supabase secrets.', 500);
    }

    if (!retell_agent_id) {
      return errRes('Please enter the Retell Agent ID for this client before enabling AI call handling.', 400);
    }

    console.log(`[provision-voice-number] Sourcing ${source} number for client ${client_id} with agent ${retell_agent_id}`);

    let twilio_sid = "";
    let twilio_token = "";
    let final_phone = phone_number;
    let a2p_status = 'not_started';

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
            return errRes('Error fetching client Twilio credentials from database.', 500);
        }

        if (!config) {
            return errRes('Client has not configured their Twilio credentials yet.', 404);
        }

        console.log('[provision-voice-number] Decrypting client Twilio credentials...');
        twilio_sid = await decryptSecret(supabaseAdmin, config.account_sid_encrypted);
        twilio_token = await decryptSecret(supabaseAdmin, config.auth_token_encrypted);
        final_phone = config.phone_number;
        console.log(`[provision-voice-number] Decrypted SID: ${twilio_sid.substring(0, 6)}..., Phone: ${final_phone}`);
    } else {
        if (!PLATFORM_TWILIO_SID || !PLATFORM_TWILIO_TOKEN) {
            return errRes('Platform Twilio credentials not configured in secrets.', 500);
        }
        twilio_sid = PLATFORM_TWILIO_SID;
        twilio_token = PLATFORM_TWILIO_TOKEN;
    }

    if (!twilio_sid || !twilio_token || !final_phone) {
        return errRes('Incomplete credentials for provisioning.', 400);
    }

    // 2. A2P STATUS CHECK
    if (source === 'platform') {
        if (a2p_status !== 'approved') {
            return errRes('A2P compliance must be approved before activating AI calls for platform-managed numbers.', 422);
        }
    } else {
        console.log('[provision-voice-number] Client-owned number — skipping A2P check.');
    }

    // 3. IDEMPOTENCY CHECK
    if (voiceConfig?.voice_status === 'active') {
        console.log('[provision-voice-number] Already active.');
        return jsonRes({ success: true, retell_phone_id: voiceConfig.retell_phone_id, message: "Already active." });
    }

    // 4. CALL RETELL API
    console.log(`[provision-voice-number] Importing ${final_phone} into Retell with agent ${retell_agent_id}...`);

    const retellBody = {
        phone_number: final_phone,
        agent_id: retell_agent_id,
        telephony_provider: 'twilio',
        twilio_account_sid: twilio_sid,
        twilio_auth_token: twilio_token,
    };

    console.log('[provision-voice-number] Retell request body keys:', Object.keys(retellBody).join(', '));

    const retellResponse = await fetch('https://api.retellai.com/v2/create-phone-number', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RETELL_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(retellBody),
    });

    const retellText = await retellResponse.text();
    console.log(`[provision-voice-number] Retell response status: ${retellResponse.status}, body: ${retellText}`);

    let retellData: any;
    try {
        retellData = JSON.parse(retellText);
    } catch {
        return errRes(`Retell returned non-JSON response (${retellResponse.status}): ${retellText.substring(0, 200)}`, 400);
    }

    if (!retellResponse.ok) {
        await supabaseAdmin.from('client_voice_integrations').upsert({
            client_id,
            voice_status: 'failed',
            number_source: source,
            phone_number: final_phone
        }, { onConflict: 'client_id' });

        const errorMessage = retellData.error?.message
            || retellData.message
            || retellData.detail
            || `Retell API error (${retellResponse.status})`;

        return errRes(`Retell Error: ${errorMessage}`, 400);
    }

    // 5. SAVE RESULT
    const retellPhoneId = retellData.phone_number_id || retellData.phone_id || retellData.id;

    const { error: dbError } = await supabaseAdmin
        .from('client_voice_integrations')
        .upsert({
            client_id,
            retell_phone_id: retellPhoneId,
            phone_number: final_phone,
            number_source: source,
            voice_status: 'active',
            a2p_registration_data: a2p_data || voiceConfig?.a2p_registration_data || {},
            a2p_status: source === 'platform' ? 'approved' : a2p_status
        }, { onConflict: 'client_id' });

    if (dbError) return errRes('Provisioned in Retell but failed to update local DB.', 500);

    console.log(`[provision-voice-number] Success! Retell phone ID: ${retellPhoneId}`);
    return jsonRes({ success: true, retell_phone_id: retellPhoneId });

  } catch (error: any) {
    console.error('[provision-voice-number] Crash:', error.message, error.stack);
    return errRes(error.message, 500);
  }
});
