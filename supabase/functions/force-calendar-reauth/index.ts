export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

function getBearerToken(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice('Bearer '.length).trim();
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const token = getBearerToken(req);
    if (!token) return errorResponse('Missing authorization header', 401);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user || null;
    if (userErr || !user) {
      console.error('[force-calendar-reauth] auth.getUser failed', { message: userErr?.message });
      return errorResponse('Unauthorized', 401);
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.error('[force-calendar-reauth] profile lookup failed', { message: profileErr.message });
      return errorResponse('Unauthorized', 401);
    }

    if (profile?.role !== 'admin') {
      return errorResponse('Forbidden', 403);
    }

    const body = await req.json();
    const clientId = body?.client_id;
    if (!clientId) return errorResponse('Missing required field: client_id', 400);

    // Force the state only; do NOT delete tokens.
    const { error: upsertErr } = await supabaseAdmin
      .from('client_google_calendar')
      .upsert(
        {
          client_id: clientId,
          connection_status: 'needs_reauth',
          reauth_reason: 'forced_by_admin',
          last_error: null,
        },
        { onConflict: 'client_id' }
      );

    if (upsertErr) {
      console.error('[force-calendar-reauth] DB update failed', { message: upsertErr.message });
      return errorResponse('Failed to force re-auth.', 500);
    }

    return jsonResponse({ success: true });
  } catch (e: any) {
    console.error('[force-calendar-reauth] Error', { message: e?.message });
    return errorResponse(e?.message || 'Unexpected error', 500);
  }
});
