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
    // Admin-only: verify Supabase JWT manually
    const token = getBearerToken(req);
    if (!token) return errorResponse('Missing authorization header', 401);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user || null;
    if (userErr || !user) {
      console.error('[get-calendar-diagnostics] auth.getUser failed', { message: userErr?.message });
      return errorResponse('Unauthorized', 401);
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.error('[get-calendar-diagnostics] profile lookup failed', { message: profileErr.message });
      return errorResponse('Unauthorized', 401);
    }

    if (profile?.role !== 'admin') {
      return errorResponse('Forbidden', 403);
    }

    const body = await req.json();
    const clientId = body?.client_id;
    if (!clientId) return errorResponse('Missing required field: client_id', 400);

    // Google Calendar row
    const { data: gc } = await supabaseAdmin
      .from('client_google_calendar')
      .select(
        'connection_status, refresh_token_present, access_token_expires_at, calendar_id, last_successful_calendar_call, last_error, reauth_reason'
      )
      .eq('client_id', clientId)
      .maybeSingle();

    // Cal.com Calendar row
    const { data: cal } = await supabaseAdmin
      .from('client_cal_calendar')
      .select(
        'connection_status, refresh_token_present, access_token_expires_at, default_event_type_id, last_successful_calendar_call, last_error, reauth_reason'
      )
      .eq('client_id', clientId)
      .maybeSingle();

    // Retell/voice linkage (context)
    const [{ data: agentSettings }, { data: voice }] = await Promise.all([
      supabaseAdmin
        .from('ai_agent_settings')
        .select('retell_agent_id')
        .eq('client_id', clientId)
        .maybeSingle(),
      supabaseAdmin
        .from('client_voice_integrations')
        .select('retell_agent_id, voice_status')
        .eq('client_id', clientId)
        .maybeSingle(),
    ]);

    return jsonResponse({
      client_id: clientId,
      retell_agent_id: agentSettings?.retell_agent_id || voice?.retell_agent_id || null,
      retell_voice_status: voice?.voice_status || null,
      google_calendar: {
        connection_status: gc?.connection_status || 'disconnected',
        refresh_token_present: gc?.refresh_token_present === true,
        access_token_expires_at: gc?.access_token_expires_at || null,
        calendar_id: gc?.calendar_id || 'primary',
        last_successful_calendar_call: gc?.last_successful_calendar_call || null,
        last_error: gc?.last_error || null,
        reauth_reason: gc?.reauth_reason || null,
      },
      cal_com: {
        connection_status: cal?.connection_status || 'disconnected',
        refresh_token_present: cal?.refresh_token_present === true,
        access_token_expires_at: cal?.access_token_expires_at || null,
        default_event_type_id: cal?.default_event_type_id || null,
        last_successful_calendar_call: cal?.last_successful_calendar_call || null,
        last_error: cal?.last_error || null,
        reauth_reason: cal?.reauth_reason || null,
      },
    });
  } catch (e: any) {
    console.error('[get-calendar-diagnostics] Error', { message: e?.message });
    return errorResponse(e?.message || 'Unexpected error', 500);
  }
});