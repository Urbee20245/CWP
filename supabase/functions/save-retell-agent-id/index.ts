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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { client_id, retell_agent_id, number_source } = await req.json();

    if (!client_id || !retell_agent_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: client_id or retell_agent_id.' }), {
        status: 400, headers: corsHeaders,
      });
    }

    console.log(`[save-retell-agent-id] Saving agent ID ${retell_agent_id} for client ${client_id}`);

    const { data: existing } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('a2p_status, a2p_registration_data, voice_status')
        .eq('client_id', client_id)
        .maybeSingle();

    const payload: any = {
        client_id,
        retell_agent_id,
    };

    if (number_source) {
        payload.number_source = number_source;
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
        return new Response(JSON.stringify({ error: `Database update failed: ${upsertError.message}` }), {
          status: 500, headers: corsHeaders,
        });
    }

    console.log('[save-retell-agent-id] Agent ID saved successfully.');
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: corsHeaders,
    });

  } catch (error: any) {
    console.error('[save-retell-agent-id] Unhandled error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: corsHeaders,
    });
  }
});
