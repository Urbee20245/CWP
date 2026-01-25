import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || 'https://yourdomain.com/api/google/callback';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!GOOGLE_CLIENT_ID) {
    return errorResponse('GOOGLE_CLIENT_ID is not configured.', 500);
  }

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse('Client ID is required.', 400);
    }

    const scope = 'https://www.googleapis.com/auth/calendar.events';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: scope,
      access_type: 'offline', // Required to get a refresh token
      prompt: 'consent', // Always ask for consent
      state: client_id, // Pass client_id through state for callback
    }).toString();

    console.log(`[google-oauth-init] Generated URL for client ${client_id}`);
    return jsonResponse({ auth_url: authUrl });

  } catch (error: any) {
    console.error('[google-oauth-init] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});