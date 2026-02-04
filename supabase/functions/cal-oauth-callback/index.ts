import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { encryptSecret } from '../_shared/encryption.ts';

const CAL_CLIENT_ID = Deno.env.get('CAL_CLIENT_ID');
const CAL_CLIENT_SECRET = Deno.env.get('CAL_CLIENT_SECRET');
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

function configErrorRedirect(missing: string[]) {
  const dest = appendParams(CLIENT_REDIRECT_URL, {
    provider: 'cal',
    status: 'error',
    error: 'server_configuration_error',
    missing: missing.join(','),
  });
  return Response.redirect(dest, 303);
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
      console.error('[cal-oauth-callback] Missing code or state.');
      return new Response('OAuth failed: Missing authorization code or state.', { status: 400, headers: corsHeaders });
    }

    const missing: string[] = [];
    if (!CAL_CLIENT_ID) missing.push('CAL_CLIENT_ID');
    if (!CAL_CLIENT_SECRET) missing.push('CAL_CLIENT_SECRET');
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');

    if (missing.length > 0) {
      console.error('[cal-oauth-callback] Missing configuration secrets.', { missing });
      // Redirect back to the client settings page so the UI can display a helpful message.
      return configErrorRedirect(missing);
    }

    // Resolve client_id + return_to from one-time state token
    const { data: stateRow, error: stateErr } = await supabaseAdmin
      .from('cal_oauth_states')
      .select('client_id, expires_at, return_to')
      .eq('state_token', stateToken)
      .maybeSingle();

    if (stateErr || !stateRow) {
      console.error('[cal-oauth-callback] Invalid or unknown state token.', { message: stateErr?.message });
      return new Response('OAuth failed: Invalid state.', { status: 400, headers: corsHeaders });
    }

    if (stateRow.expires_at && new Date(stateRow.expires_at).getTime() < Date.now()) {
      console.error('[cal-oauth-callback] State token expired.');
      return new Response('OAuth failed: State expired. Please reconnect.', { status: 400, headers: corsHeaders });
    }

    const clientId = stateRow.client_id;
    const returnTo = typeof stateRow.return_to === 'string' && stateRow.return_to.trim() ? stateRow.return_to.trim() : null;

    // One-time use: delete state
    await supabaseAdmin.from('cal_oauth_states').delete().eq('state_token', stateToken);

    const redirectUri = `${SUPABASE_URL}/functions/v1/cal-oauth-callback`;
    console.log(`[cal-oauth-callback] Received code for client ${clientId}. Exchanging tokens.`);
    console.log(`[cal-oauth-callback] redirect_uri=${redirectUri}`);

    // Load existing connection (if any)
    const { data: existingConn } = await supabaseAdmin
      .from('client_cal_calendar')
      .select('cal_refresh_token, default_event_type_id')
      .eq('client_id', clientId)
      .maybeSingle();

    // Exchange authorization code for tokens
    // Try app.cal.com first (matches the authorize domain), then fall back to api.cal.com
    const tokenEndpoints = [
      'https://app.cal.com/api/auth/oauth/token',
      'https://api.cal.com/oauth/token',
    ];

    const tokenBody = {
      code,
      client_id: CAL_CLIENT_ID,
      client_secret: CAL_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };

    let tokenData: any = null;
    let lastError: string | null = null;

    for (const endpoint of tokenEndpoints) {
      console.log(`[cal-oauth-callback] Trying token endpoint: ${endpoint}`);
      try {
        const tokenResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenBody),
        });

        const responseText = await tokenResponse.text();
        console.log(`[cal-oauth-callback] ${endpoint} status=${tokenResponse.status} body=${responseText}`);

        try {
          tokenData = JSON.parse(responseText);
        } catch {
          console.error(`[cal-oauth-callback] Non-JSON response from ${endpoint}`);
          lastError = `Non-JSON response (status ${tokenResponse.status})`;
          continue;
        }

        if (tokenData.error) {
          lastError = tokenData.error_description || tokenData.error;
          console.error(`[cal-oauth-callback] ${endpoint} returned error: ${lastError}`);
          tokenData = null;
          continue;
        }

        // Success - break out of loop
        console.log(`[cal-oauth-callback] Token exchange succeeded via ${endpoint}`);
        break;
      } catch (fetchErr: any) {
        lastError = fetchErr.message;
        console.error(`[cal-oauth-callback] Fetch to ${endpoint} failed: ${lastError}`);
        continue;
      }
    }

    if (!tokenData) {
      const errMsg = `Token exchange failed on all endpoints: ${lastError}`;
      console.error(`[cal-oauth-callback] ${errMsg}`);
      return new Response(errMsg, { status: 400, headers: corsHeaders });
    }

    const accessToken: string | undefined = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;
    const expiresIn: number | undefined = tokenData.expires_in;

    if (!accessToken) {
      console.error('[cal-oauth-callback] Token exchange succeeded but access_token is missing.');
      return new Response('Token exchange failed: access_token missing.', { status: 400, headers: corsHeaders });
    }

    // Prefer new refresh token; fall back to existing if present
    let encryptedRefreshToken: string = '';
    if (refreshToken && refreshToken.trim()) {
      encryptedRefreshToken = await encryptSecret(refreshToken);
    } else if (existingConn?.cal_refresh_token && existingConn.cal_refresh_token.trim()) {
      encryptedRefreshToken = existingConn.cal_refresh_token;
      console.warn(`[cal-oauth-callback] refresh_token not returned by Cal.com; reusing existing refresh token for client ${clientId}.`);
    } else {
      console.warn(`[cal-oauth-callback] refresh_token missing after OAuth for client ${clientId}. Marking needs_reauth.`);
    }

    const encryptedAccessToken = await encryptSecret(accessToken);
    const refreshTokenPresent = !!(encryptedRefreshToken && encryptedRefreshToken.trim());

    const now = new Date();
    const expiresAt = typeof expiresIn === 'number' && expiresIn > 0
      ? new Date(now.getTime() + expiresIn * 1000).toISOString()
      : null;

    // Fetch Cal.com user info to get user ID
    let calUserId: string | null = null;
    try {
      const meResponse = await fetch('https://api.cal.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const meData = await meResponse.json();
      if (meResponse.ok && meData?.data?.id) {
        calUserId = String(meData.data.id);
      }
    } catch (e: any) {
      console.warn('[cal-oauth-callback] Failed to fetch Cal.com user info:', e.message);
    }

    const { error: upsertError } = await supabaseAdmin
      .from('client_cal_calendar')
      .upsert({
        client_id: clientId,
        cal_access_token: encryptedAccessToken,
        cal_refresh_token: encryptedRefreshToken || '',
        refresh_token_present: refreshTokenPresent,
        access_token_expires_at: expiresAt,
        cal_user_id: calUserId,
        default_event_type_id: existingConn?.default_event_type_id || null,
        connection_status: refreshTokenPresent ? 'connected' : 'needs_reauth',
        reauth_reason: refreshTokenPresent ? null : 'missing_refresh_token',
        last_error: null,
        last_synced_at: now.toISOString(),
      }, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('[cal-oauth-callback] DB upsert failed:', upsertError);
      return new Response('Failed to save calendar connection.', { status: 500, headers: corsHeaders });
    }

    console.log(`[cal-oauth-callback] Connection saved for client ${clientId}. refresh_token_present=${refreshTokenPresent}`);

    const status = refreshTokenPresent ? 'success' : 'needs_reauth';
    const destBase = returnTo || CLIENT_REDIRECT_URL;
    const dest = appendParams(destBase, { status, client_id: clientId, provider: 'cal' });
    return Response.redirect(dest, 303);

  } catch (error: any) {
    console.error('[cal-oauth-callback] Unhandled error:', error.message);
    return new Response('Internal server error during callback.', { status: 500, headers: corsHeaders });
  }
});