import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Use service role key to bypass RLS
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
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
          auth_token_encrypted
        )
      `)
      .order('business_name', { ascending: true });

    if (fetchError) {
      console.error('[get-voice-clients] Error fetching clients:', fetchError);
      return errorResponse(`Failed to fetch clients: ${fetchError.message}`, 500);
    }

    return jsonResponse({ clients: clientsData });

  } catch (error: any) {
    console.error('[get-voice-clients] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
