import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { encryptSecret } from '../_shared/encryption.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const CLIENT_REDIRECT_URL = Deno.env.get('CLIENT_REDIRECT_URL') || 'https://www.customwebsitesplus.com/client/settings';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function appendParams(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateToken = url.searchParams.get('state');

    if (!code || !stateToken) {
      console.error('[google-oauth-callback] Missing code or state.');
      return new Response('OAuth failed: Missing authorization code or state.', { status: 400, headers: corsHeaders });
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SUPABASE_URL) {
      console.error('[google-oauth-callback] Missing Google or Supabase configuration.');
      return new Response('Server configuration error.', { status: 500, headers: corsHeaders });
    }

    // Resolve client_id + return_to from one-time state token
    const { data: stateRow, error: stateErr } = await supabaseAdmin
      .from('google_oauth_states')
      .select('client_id, expires_at, return_to')
      .eq('state_token', stateToken)
      .maybeSingle();

    if (stateErr || !stateRow) {
      console.error('[google-oauth-callback] Invalid or unknown state token.', { message: stateErr?.message });
      return new Response('OAuth failed: Invalid state.', { status: 400, headers: corsHeaders });
    }

    if (stateRow.expires_at && new Date(stateRow.expires_at).getTime() < Date.now()) {
      console.error('[google-oauth-callback] State token expired.');
      return new Response('OAuth failed: State expired. Please reconnect.', { status: 400, headers: corsHeaders });
    }

    const clientId = stateRow.client_id;
    const returnTo = typeof stateRow.return_to === 'string' && stateRow.return_to.trim() ? stateRow.return_to.trim() : null;

    // One-time use: delete state
    await supabaseAdmin.from('google_oauth_states').delete().eq('state_token', stateToken);

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
    console.log(`[google-oauth-callback] Received code for client ${clientId}. Exchanging tokens.`);

    // Load existing connection (if any)
    const { data: existingConn } = await supabaseAdmin
      .from('client_google_calendar')
      .select('google_refresh_token, calendar_id')
      .eq('client_id', clientId)
      .maybeSingle();

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[google-oauth-callback] Token exchange failed:', tokenData.error_description || tokenData.error);
      return new Response(`Token exchange failed: ${tokenData.error_description || tokenData.error}`, { status: 400, headers: corsHeaders });
    }

    const accessToken: string | undefined = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;
    const expiresIn: number | undefined = tokenData.expires_in;

    if (!accessToken) {
      console.error('[google-oauth-callback] Token exchange succeeded but access_token is missing.');
      return new Response('Token exchange failed: access_token missing.', { status: 400, headers: corsHeaders });
    }

    // Prefer new refresh token; fall back to existing if present
    let encryptedRefreshToken: string = '';
    if (refreshToken && refreshToken.trim()) {
      encryptedRefreshToken = await encryptSecret(refreshToken);
    } else if (existingConn?.google_refresh_token && existingConn.google_refresh_token.trim()) {
      encryptedRefreshToken = existingConn.google_refresh_token;
      console.warn(`[google-oauth-callback] refresh_token not returned by Google; reusing existing refresh token for client ${clientId}.`);
    } else {
      console.warn(`[google-oauth-callback] refresh_token missing after OAuth for client ${clientId}. Marking needs_reauth.`);
    }

    const encryptedAccessToken = await encryptSecret(accessToken);
    const refreshTokenPresent = !!(encryptedRefreshToken && encryptedRefreshToken.trim());

    const now = new Date();
    const expiresAt = typeof expiresIn === 'number' && expiresIn > 0
      ? new Date(now.getTime() + expiresIn * 1000).toISOString()
      : null;

    const calendarId = existingConn?.calendar_id || 'primary';

    const { error: upsertError } = await supabaseAdmin
      .from('client_google_calendar')
      .upsert({
        client_id: clientId,
        google_access_token: encryptedAccessToken,
        google_refresh_token: encryptedRefreshToken || '',
        refresh_token_present: refreshTokenPresent,
        access_token_expires_at: expiresAt,
        calendar_id: calendarId,
        connection_status: refreshTokenPresent ? 'connected' : 'needs_reauth',
        reauth_reason: refreshTokenPresent ? null : 'missing_refresh_token',
        last_error: null,
        last_synced_at: now.toISOString(),
      }, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('[google-oauth-callback] DB upsert failed:', upsertError);
      return new Response('Failed to save calendar connection.', { status: 500, headers: corsHeaders });
    }

    console.log(`[google-oauth-callback] Connection saved for client ${clientId}. refresh_token_present=${refreshTokenPresent}`);

    const status = refreshTokenPresent ? 'success' : 'needs_reauth';
    const destBase = returnTo || CLIENT_REDIRECT_URL;
    const dest = appendParams(destBase, { status, client_id: clientId });
    return Response.redirect(dest, 303);

  } catch (error: any) {
    console.error('[google-oauth-callback] Unhandled error:', error.message);
    return new Response('Internal server error during callback.', { status: 500, headers: corsHeaders });
  }
});