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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { client_id, retell_agent_id, number_source, phone_number } = await req.json();

    if (!client_id) {
      return jsonRes({ error: 'Missing required field: client_id.' }, 400);
    }

    const agentId = typeof retell_agent_id === 'string' ? retell_agent_id.trim() : '';
    const source = typeof number_source === 'string' ? number_source : undefined;
    const platformPhone = typeof phone_number === 'string' ? phone_number.trim() : '';

    if (!agentId && !platformPhone) {
      return jsonRes({ error: 'Nothing to save. Provide retell_agent_id and/or phone_number.' }, 400);
    }

    console.log(`[save-retell-agent-id] Saving voice config for client ${client_id}`, {
      has_agent_id: !!agentId,
      has_phone_number: !!platformPhone,
      number_source: source,
    });

    const { data: existing } = await supabaseAdmin
      .from('client_voice_integrations')
      .select('a2p_status, a2p_registration_data, voice_status, number_source')
      .eq('client_id', client_id)
      .maybeSingle();

    const payload: any = {
      client_id,
    };

    // Always include a number_source on first insert (column is NOT NULL)
    payload.number_source = source || existing?.number_source || 'platform';

    if (agentId) {
      payload.retell_agent_id = agentId;
    }

    // Only store phone_number when platform-managed. For client-managed numbers, we read from Twilio integration.
    if (platformPhone) {
      if (payload.number_source !== 'platform') {
        return jsonRes({ error: 'phone_number can only be saved when number_source is "platform".' }, 400);
      }
      // Basic E.164-ish check (kept intentionally simple)
      if (!/^\+\d{8,15}$/.test(platformPhone)) {
        return jsonRes({ error: 'Invalid phone number format. Use E.164 format like +14045551234.' }, 400);
      }
      payload.phone_number = platformPhone;
    }

    if (!existing) {
      payload.voice_status = 'inactive';
      payload.a2p_status = 'not_started';
    }

    if (existing?.voice_status === 'failed') {
      payload.voice_status = 'inactive';
    }

    const { error: upsertError } = await supabaseAdmin
      .from('client_voice_integrations')
      .upsert(payload, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('[save-retell-agent-id] DB upsert failed:', upsertError);
      return jsonRes({ error: `Database update failed: ${upsertError.message}` }, 500);
    }

    console.log('[save-retell-agent-id] Voice config saved successfully.');
    return jsonRes({ success: true });
  } catch (error: any) {
    console.error('[save-retell-agent-id] Unhandled error:', error.message);
    return jsonRes({ error: error.message }, 500);
  }
});