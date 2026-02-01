import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!GOOGLE_CLIENT_ID) return errorResponse('GOOGLE_CLIENT_ID is not configured.', 500);
  if (!SUPABASE_URL) return errorResponse('SUPABASE_URL is not configured.', 500);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // --- Authn/Authz: only the client owner (or an admin) may start OAuth for a client_id ---
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
    if (!token) return errorResponse('Missing authorization header', 401);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user || null;
    if (userErr || !user) {
      console.error('[google-oauth-init] auth.getUser failed', { message: userErr?.message });
      return errorResponse('Unauthorized', 401);
    }

    const { client_id } = await req.json();
    if (!client_id) return errorResponse('Client ID is required.', 400);

    // Check admin role OR ownership
    const [{ data: profile }, { data: ownsClient }] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('clients').select('id').eq('id', client_id).eq('owner_profile_id', user.id).maybeSingle(),
    ]);

    const isAdmin = profile?.role === 'admin';
    if (!isAdmin && !ownsClient) {
      console.warn('[google-oauth-init] Forbidden OAuth init attempt', { user_id: user.id, client_id });
      return errorResponse('Forbidden', 403);
    }

    // --- OAuth params ---
    // Scopes:
    // - calendar.events: create events (booking)
    // - calendar.events.freebusy: check availability via freeBusy endpoint
    // - spreadsheets: optional lead logging to Google Sheets
    const scope = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.events.freebusy',
      'https://www.googleapis.com/auth/spreadsheets'
    ].join(' ');

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

    // IMPORTANT: use a one-time state token, not raw client_id.
    // This prevents a forged callback from binding tokens to the wrong client.
    const stateToken = crypto.randomUUID();

    // Store state for 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: stateErr } = await supabaseAdmin
      .from('google_oauth_states')
      .insert({
        state_token: stateToken,
        client_id,
        created_by: user.id,
        expires_at: expiresAt,
      });

    if (stateErr) {
      console.error('[google-oauth-init] Failed to persist oauth state', { message: stateErr.message });
      return errorResponse('Failed to start OAuth. Please try again.', 500);
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      access_type: 'offline', // refresh token
      prompt: 'consent',      // ensure refresh token
      state: stateToken,
    }).toString();

    console.log(`[google-oauth-init] Generated OAuth URL for client ${client_id}`);
    return jsonResponse({ auth_url: authUrl });

  } catch (error: any) {
    console.error('[google-oauth-init] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});