import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse('Supabase env vars missing.', 500);
  }

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse('"client_id" is required.', 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[get-sms-messages] Query error:', error.message);
      return errorResponse(`Failed to fetch messages: ${error.message}`, 500);
    }

    return jsonResponse(data ?? []);
  } catch (err: any) {
    console.error('[get-sms-messages] Error:', err.message);
    return errorResponse(`Unexpected error: ${err.message}`, 500);
  }
});
