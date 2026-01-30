import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
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

    const { data: clientsData, error: fetchError } = await supabaseAdmin
      .from('clients')
      .select(`
        id, 
        business_name, 
        phone, 
        client_voice_integrations (
          voice_status,
          number_source,
          a2p_status,
          retell_agent_id,
          phone_number,
          retell_phone_id
        ),
        client_integrations (
          provider,
          phone_number,
          account_sid_encrypted,
          auth_token_encrypted,
          connection_method
        )
      `)
      .order('business_name', { ascending: true });

    if (fetchError) {
      console.error('[get-voice-clients] Query error:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ clients: clientsData }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error('[get-voice-clients] Crash:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});