import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
// NOTE: We now compute the callback URL from SUPABASE_URL instead of relying on GOOGLE_REDIRECT_URI
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!GOOGLE_CLIENT_ID) {
    return errorResponse('GOOGLE_CLIENT_ID is not configured.', 500);
  }
  if (!SUPABASE_URL) {
    return errorResponse('SUPABASE_URL is not configured.', 500);
  }

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse('Client ID is required.', 400);
    }

    // Request Calendar events + Sheets scopes
    const scope = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/spreadsheets'
    ].join(' ');

    // Supabase Functions callback
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      access_type: 'offline', // refresh token
      prompt: 'consent',      // ensure refresh token
      state: client_id,       // pass client_id through state
    }).toString();

    console.log(`[google-oauth-init] Generated URL for client ${client_id}`);
    return jsonResponse({ auth_url: authUrl });

  } catch (error: any) {
    console.error('[google-oauth-init] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});