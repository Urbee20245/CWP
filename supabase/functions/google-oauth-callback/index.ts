import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { decryptSecret, encryptSecret } from '../_shared/encryption.ts'; // Assuming encryption functions are available
import { errorResponse } from '../_shared/utils.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || 'https://yourdomain.com/api/google/callback';
const CLIENT_REDIRECT_URL = Deno.env.get('CLIENT_REDIRECT_URL') || 'https://yourdomain.com/client/settings';

serve(async (req) => {
  // CORS is not strictly needed for a redirect handler, but we include it for safety
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // Initialize Supabase Admin client for privileged DB access
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // This is the client_id

    if (!code || !state) {
      console.error('[google-oauth-callback] Missing code or state.');
      return new Response('OAuth failed: Missing authorization code or client state.', { status: 400 });
    }
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        console.error('[google-oauth-callback] Missing Google secrets.');
        return new Response('Server configuration error.', { status: 500 });
    }

    const clientId = state;
    console.log(`[google-oauth-callback] Received code for client ${clientId}. Exchanging tokens.`);

    // 1. Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[google-oauth-callback] Token exchange failed:', tokenData.error_description);
      return new Response(`Token exchange failed: ${tokenData.error_description}`, { status: 400 });
    }

    const { access_token, refresh_token } = tokenData;
    
    if (!refresh_token) {
        console.error('[google-oauth-callback] Refresh token missing. Ensure access_type=offline and prompt=consent were used.');
        return new Response('Refresh token missing. Please re-authenticate.', { status: 400 });
    }

    // 2. Encrypt and store tokens
    const encryptedAccessToken = await encryptSecret(access_token);
    const encryptedRefreshToken = await encryptSecret(refresh_token);

    const { error: upsertError } = await supabaseAdmin
      .from('client_google_calendar')
      .upsert({
        client_id: clientId,
        google_access_token: encryptedAccessToken,
        google_refresh_token: encryptedRefreshToken,
        connection_status: 'connected',
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('[google-oauth-callback] DB upsert failed:', upsertError);
      return new Response('Failed to save calendar connection.', { status: 500 });
    }

    console.log(`[google-oauth-callback] Connection successful for client ${clientId}. Redirecting.`);

    // 3. Redirect back to the client settings page
    return Response.redirect(`${CLIENT_REDIRECT_URL}?status=success&client_id=${clientId}`, 303);

  } catch (error: any) {
    console.error('[google-oauth-callback] Unhandled error:', error.message);
    return new Response('Internal server error during callback.', { status: 500 });
  }
});