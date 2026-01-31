export const config = {
  auth: false,
};

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

    // 1) Load voice config (for A2P status + optional fallback to stored agent id)
    const { data: voiceConfig, error: voiceConfigError } = await supabaseAdmin
      .from('client_voice_integrations')
      .select('retell_phone_id, voice_status, a2p_registration_data, a2p_status, retell_agent_id, phone_number, number_source')
      .eq('client_id', client_id)
      .maybeSingle();

    if (voiceConfigError) {
      console.error('[provision-voice-number] Error fetching voice config:', voiceConfigError);
    }

    const agentIdFromRequest = typeof retell_agent_id === 'string' ? retell_agent_id.trim() : '';
    const agentIdFromDb = typeof voiceConfig?.retell_agent_id === 'string' ? voiceConfig.retell_agent_id.trim() : '';
    const finalAgentId = agentIdFromRequest || agentIdFromDb;

    // For platform numbers, prefer request phone_number, else stored phone_number
    const phoneFromRequest = typeof phone_number === 'string' ? phone_number.trim() : '';
    const phoneFromDb = typeof voiceConfig?.phone_number === 'string' ? voiceConfig.phone_number.trim() : '';

    const a2p_status = voiceConfig?.a2p_status || 'not_started';

    // If this is platform-managed and A2P is NOT approved yet, we do NOT provision.
    // Instead we mark the integration as pending so you can "Enable" now and auto-provision later.
    if (source === 'platform' && a2p_status !== 'approved') {
      if (!finalAgentId) {
        return errRes('Please save the Retell Agent ID first.', 400);
      }

      const final_phone_for_pending = phoneFromRequest || phoneFromDb;
      if (!final_phone_for_pending) {
        return errRes('Please save the platform phone number first.', 400);
      }

      const { error: pendingErr } = await supabaseAdmin
        .from('client_voice_integrations')
        .upsert({
          client_id,
          number_source: 'platform',
          retell_agent_id: finalAgentId,
          phone_number: final_phone_for_pending,
          voice_status: 'pending',
          a2p_registration_data: a2p_data || voiceConfig?.a2p_registration_data || {},
          a2p_status,
        }, { onConflict: 'client_id' });

      if (pendingErr) {
        console.error('[provision-voice-number] Failed to mark pending:', pendingErr);
        return errRes(`Failed to mark pending: ${pendingErr.message}`, 500);
      }

      return jsonRes({
        success: true,
        pending: true,
        message: 'Saved and marked as pending. It will auto-activate after A2P is approved.',
      });
    }

    // 2) From here down: real provisioning into Retell
    if (!RETELL_API_KEY) {
      return errRes('Retell API Key is not configured. Please add RETELL_API_KEY to Supabase secrets.', 500);
    }

    if (!finalAgentId) {
      return errRes('Please enter the Retell Agent ID for this client before enabling AI call handling.', 400);
    }

    console.log(`[provision-voice-number] Sourcing ${source} number for client ${client_id} with agent ${finalAgentId}`);

    let twilio_sid = "";
    let twilio_token = "";
    let final_phone = phoneFromRequest || phoneFromDb;

    // 3) Gather Twilio credentials and resolve final_phone
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

    // 4) Idempotency check
    if (voiceConfig?.voice_status === 'active') {
      console.log('[provision-voice-number] Already active.');
      return jsonRes({ success: true, retell_phone_id: voiceConfig.retell_phone_id, message: "Already active." });
    }

    // 5) Call Retell API
    console.log(`[provision-voice-number] Importing ${final_phone} into Retell with agent ${finalAgentId}...`);

    const retellBody = {
      phone_number: final_phone,
      agent_id: finalAgentId,
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
        phone_number: final_phone,
        retell_agent_id: finalAgentId,
      }, { onConflict: 'client_id' });

      const errorMessage = retellData.error?.message
        || retellData.message
        || retellData.detail
        || `Retell API error (${retellResponse.status})`;

      return errRes(`Retell Error: ${errorMessage}`, 400);
    }

    // 6) Save result
    const retellPhoneId = retellData.phone_number_id || retellData.phone_id || retellData.id;

    const { error: dbError } = await supabaseAdmin
      .from('client_voice_integrations')
      .upsert({
        client_id,
        retell_phone_id: retellPhoneId,
        phone_number: final_phone,
        number_source: source,
        voice_status: 'active',
        retell_agent_id: finalAgentId,
        a2p_registration_data: a2p_data || voiceConfig?.a2p_registration_data || {},
        a2p_status: source === 'platform' ? 'approved' : a2p_status,
      }, { onConflict: 'client_id' });

    if (dbError) return errRes('Provisioned in Retell but failed to update local DB.', 500);

    console.log(`[provision-voice-number] Success! Retell phone ID: ${retellPhoneId}`);
    return jsonRes({ success: true, retell_phone_id: retellPhoneId });

  } catch (error: any) {
    console.error('[provision-voice-number] Crash:', error.message, error.stack);
    return errRes(error.message, 500);
  }
});