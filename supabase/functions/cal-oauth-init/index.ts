import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const CAL_CLIENT_ID = Deno.env.get('CAL_CLIENT_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!CAL_CLIENT_ID) return errorResponse('CAL_CLIENT_ID is not configured.', 500);
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
      console.error('[cal-oauth-init] auth.getUser failed', { message: userErr?.message });
      return errorResponse('Unauthorized', 401);
    }

    const { client_id, return_to } = await req.json();
    if (!client_id) return errorResponse('Client ID is required.', 400);

    // Check admin role OR ownership
    const [{ data: profile }, { data: ownsClient }] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('clients').select('id').eq('id', client_id).eq('owner_profile_id', user.id).maybeSingle(),
    ]);

    const isAdmin = profile?.role === 'admin';
    if (!isAdmin && !ownsClient) {
      console.warn('[cal-oauth-init] Forbidden OAuth init attempt', { user_id: user.id, client_id });
      return errorResponse('Forbidden', 403);
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/cal-oauth-callback`;

    // IMPORTANT: use a one-time state token, not raw client_id.
    const stateToken = crypto.randomUUID();

    // Store state for 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: stateErr } = await supabaseAdmin
      .from('cal_oauth_states')
      .insert({
        state_token: stateToken,
        client_id,
        created_by: user.id,
        return_to: typeof return_to === 'string' ? return_to : null,
        expires_at: expiresAt,
      });

    if (stateErr) {
      console.error('[cal-oauth-init] Failed to persist oauth state', { message: stateErr.message });
      return errorResponse('Failed to start OAuth. Please try again.', 500);
    }

    const scope = 'READ_AVAILABILITY WRITE_BOOKINGS offline_access';

    const authUrl = `https://app.cal.com/auth/oauth2/authorize?` + new URLSearchParams({
      client_id: CAL_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      prompt: 'consent', // Ensure consent screen is shown
      state: stateToken,
    }).toString();

    console.log(`[cal-oauth-init] Generated OAuth URL for client ${client_id}`);
    return jsonResponse({ auth_url: authUrl });

  } catch (error: any) {
    console.error('[cal-oauth-init] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});