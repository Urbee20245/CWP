export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { encryptSecret } from '../_shared/encryption.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // --- Authn: validate the calling user's JWT ---
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
    if (!token) return errorResponse('Missing authorization header', 401);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user || null;
    if (userErr || !user) {
      console.error('[save-cal-api-key] auth.getUser failed', { message: userErr?.message });
      return errorResponse('Unauthorized', 401);
    }

    const { client_id, api_key } = await req.json();
    if (!client_id) return errorResponse('Client ID is required.', 400);
    if (!api_key || typeof api_key !== 'string' || !api_key.trim()) {
      return errorResponse('API key is required.', 400);
    }

    // --- Authz: only admin or client owner ---
    const [{ data: profile }, { data: ownsClient }] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('clients').select('id').eq('id', client_id).eq('owner_profile_id', user.id).maybeSingle(),
    ]);

    const isAdmin = profile?.role === 'admin';
    if (!isAdmin && !ownsClient) {
      console.warn('[save-cal-api-key] Forbidden attempt', { user_id: user.id, client_id });
      return errorResponse('Forbidden', 403);
    }

    // --- Validate the API key against Cal.com ---
    const trimmedKey = api_key.trim();
    console.log(`[save-cal-api-key] Validating API key for client ${client_id}`);

    const meResponse = await fetch('https://api.cal.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${trimmedKey}`,
        'cal-api-version': '2024-08-13',
      },
    });

    if (!meResponse.ok) {
      const body = await meResponse.text();
      console.error('[save-cal-api-key] Cal.com /v2/me validation failed:', { status: meResponse.status, body: body.substring(0, 500) });
      return errorResponse('Invalid Cal.com API key. Please check the key and try again.', 400);
    }

    const meData = await meResponse.json();
    const calUserId = meData?.data?.id ? String(meData.data.id) : null;

    if (!calUserId) {
      console.error('[save-cal-api-key] Cal.com /v2/me returned no user ID:', JSON.stringify(meData).substring(0, 500));
      return errorResponse('Could not verify Cal.com user identity. Please try a different API key.', 400);
    }

    // --- Encrypt and store ---
    const encryptedApiKey = await encryptSecret(trimmedKey);

    // Preserve existing default_event_type_id if reconnecting
    const { data: existingConn } = await supabaseAdmin
      .from('client_cal_calendar')
      .select('default_event_type_id')
      .eq('client_id', client_id)
      .maybeSingle();

    const { error: upsertError } = await supabaseAdmin
      .from('client_cal_calendar')
      .upsert({
        client_id,
        cal_access_token: encryptedApiKey,
        cal_refresh_token: '',
        refresh_token_present: false,
        access_token_expires_at: null,
        auth_method: 'api_key',
        cal_user_id: calUserId,
        default_event_type_id: existingConn?.default_event_type_id || null,
        connection_status: 'connected',
        reauth_reason: null,
        last_error: null,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('[save-cal-api-key] DB upsert failed:', upsertError);
      return errorResponse('Failed to save API key. Please try again.', 500);
    }

    console.log(`[save-cal-api-key] API key saved for client ${client_id}, cal_user_id=${calUserId}`);
    return jsonResponse({ success: true, cal_user_id: calUserId });

  } catch (error: any) {
    console.error('[save-cal-api-key] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
