import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { decryptSecret, encryptSecret } from './encryption.ts';

const CAL_CLIENT_ID = Deno.env.get('CAL_CLIENT_ID');
const CAL_CLIENT_SECRET = Deno.env.get('CAL_CLIENT_SECRET');

if (!CAL_CLIENT_ID || !CAL_CLIENT_SECRET) {
  console.error("[calCalendarService] CRITICAL: Cal.com secrets are missing.");
}

// Initialize Supabase Admin client for privileged DB access
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface TokenData {
  accessToken: string;
  refreshToken: string;
  calUserId: string | null;
  defaultEventTypeId: string | null;
}

interface BookingDetails {
  eventTypeId: string;
  start: string; // ISO 8601
  attendee: {
    name: string;
    email: string;
    timeZone?: string;
  };
  metadata?: Record<string, any>;
}

async function markNeedsReauth(clientId: string, reason: string, message?: string) {
  try {
    await supabaseAdmin
      .from('client_cal_calendar')
      .update({
        connection_status: 'needs_reauth',
        reauth_reason: reason,
        last_error: message || null,
        refresh_token_present: false,
      })
      .eq('client_id', clientId);
  } catch (e: any) {
    console.error('[calCalendarService] Failed to mark needs_reauth:', e?.message);
  }
}

async function markConnectedOk(clientId: string) {
  try {
    await supabaseAdmin
      .from('client_cal_calendar')
      .update({
        connection_status: 'connected',
        reauth_reason: null,
        last_error: null,
        refresh_token_present: true,
      })
      .eq('client_id', clientId);
  } catch (e: any) {
    console.error('[calCalendarService] Failed to clear reauth flags:', e?.message);
  }
}

export async function markCalendarCallSuccess(clientId: string) {
  try {
    await supabaseAdmin
      .from('client_cal_calendar')
      .update({
        last_successful_calendar_call: new Date().toISOString(),
        last_error: null,
      })
      .eq('client_id', clientId);
  } catch (e: any) {
    console.error('[calCalendarService] Failed to set last_successful_calendar_call:', e?.message);
  }
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return true;
  // Refresh a bit early to avoid clock skew
  return Date.now() > t - 60_000;
}

/**
 * Fetches and decrypts tokens, refreshing the access token if necessary.
 * Safety rules:
 * - If refresh token is missing, do NOT attempt calendar access. Mark needs_reauth.
 * - If refresh token exists, refresh access token silently when expired.
 */
async function getAndRefreshTokens(clientId: string): Promise<TokenData | null> {
  if (!CAL_CLIENT_ID || !CAL_CLIENT_SECRET) return null;

  const { data: config, error: fetchError } = await supabaseAdmin
    .from('client_cal_calendar')
    .select('cal_access_token, cal_refresh_token, cal_user_id, default_event_type_id, connection_status, refresh_token_present, access_token_expires_at')
    .eq('client_id', clientId)
    .maybeSingle();

  if (fetchError || !config) {
    console.log(`[calCalendarService] No calendar config found for client ${clientId}`);
    return null;
  }

  if (config.connection_status !== 'connected') {
    console.log(`[calCalendarService] Calendar not connected for client ${clientId} (status=${config.connection_status})`);
    return null;
  }

  const refreshTokenCipher = config.cal_refresh_token || '';
  const refreshTokenPresent = !!(config.refresh_token_present && refreshTokenCipher.trim());
  if (!refreshTokenPresent) {
    console.warn(`[calCalendarService] Connected row is missing refresh token for client ${clientId}. Marking needs_reauth.`);
    await markNeedsReauth(clientId, 'missing_refresh_token', 'Refresh token missing.');
    return null;
  }

  let accessToken = '';
  let refreshToken = '';
  try {
    refreshToken = await decryptSecret(refreshTokenCipher);
  } catch (e: any) {
    console.error('[calCalendarService] Refresh token decrypt failed:', e?.message);
    await markNeedsReauth(clientId, 'decrypt_failed', 'Failed to decrypt refresh token.');
    return null;
  }

  // If access token is missing/invalid or expired, refresh it.
  const mustRefresh = !config.cal_access_token?.trim() || isExpired(config.access_token_expires_at);

  if (mustRefresh) {
    console.log(`[calCalendarService] Access token missing/expired for ${clientId}. Refreshing...`);

    const refreshResponse = await fetch('https://app.cal.com/api/auth/oauth/refreshToken', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({
        client_id: CAL_CLIENT_ID,
        client_secret: CAL_CLIENT_SECRET,
      }),
    });

    const refreshText = await refreshResponse.text();
    let refreshData: any = null;
    try { refreshData = JSON.parse(refreshText); } catch { /* ignore */ }

    if (!refreshResponse.ok || refreshData?.error) {
      const msg = refreshData?.error_description || refreshData?.error || refreshText || 'Token refresh failed';
      console.error('[calCalendarService] Token refresh failed:', msg);
      await markNeedsReauth(clientId, 'refresh_failed', msg);
      return null;
    }

    const newAccessToken: string = refreshData.access_token;
    const newRefreshToken: string | undefined = refreshData.refresh_token;
    const expiresIn: number | undefined = refreshData.expires_in;

    const newEncryptedAccessToken = await encryptSecret(newAccessToken);
    const newEncryptedRefreshToken = newRefreshToken ? await encryptSecret(newRefreshToken) : refreshTokenCipher;
    
    const nowIso = new Date().toISOString();
    const expiresAt = typeof expiresIn === 'number' && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    await supabaseAdmin
      .from('client_cal_calendar')
      .update({
        cal_access_token: newEncryptedAccessToken,
        cal_refresh_token: newEncryptedRefreshToken,
        access_token_expires_at: expiresAt,
        last_synced_at: nowIso,
        connection_status: 'connected',
        reauth_reason: null,
        last_error: null,
        refresh_token_present: true,
      })
      .eq('client_id', clientId);

    accessToken = newAccessToken;
  } else {
    try {
      accessToken = await decryptSecret(config.cal_access_token);
    } catch (e: any) {
      console.error('[calCalendarService] Access token decrypt failed:', e?.message);
      // Try a refresh; decrypt failure could be due to empty/garbled access token.
      await supabaseAdmin
        .from('client_cal_calendar')
        .update({ access_token_expires_at: null })
        .eq('client_id', clientId);
      return await getAndRefreshTokens(clientId);
    }
  }

  // Best-effort: ensure the connection is marked healthy.
  await markConnectedOk(clientId);

  return {
    accessToken,
    refreshToken,
    calUserId: config.cal_user_id || null,
    defaultEventTypeId: config.default_event_type_id || null,
  };
}

/**
 * Creates a Cal.com booking for the client.
 */
export async function createCalBooking(clientId: string, bookingDetails: BookingDetails) {
  const tokenData = await getAndRefreshTokens(clientId);

  if (!tokenData) {
    throw new Error("Calendar not connected or token refresh failed.");
  }

  const bookingPayload = {
    eventTypeId: bookingDetails.eventTypeId,
    start: bookingDetails.start,
    attendee: bookingDetails.attendee,
    metadata: bookingDetails.metadata || {},
  };

  const response = await fetch('https://api.cal.com/v2/bookings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.accessToken}`,
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
    },
    body: JSON.stringify(bookingPayload),
  });

  const responseData = await response.json();

  if (!response.ok) {
    const msg = responseData?.error?.message || responseData?.message || 'Unknown error';
    console.error('[calCalendarService] Booking creation failed:', responseData);

    if (response.status === 401 || response.status === 403) {
      const reason = responseData?.error?.code || 'calendar_api_auth_error';
      await markNeedsReauth(clientId, reason, msg);
    }

    throw new Error(`Cal.com API Error: ${msg}`);
  }

  await markCalendarCallSuccess(clientId);

  console.log(`[calCalendarService] Booking created successfully: ${responseData.data?.id}`);
  return { 
    success: true, 
    bookingId: responseData.data?.id,
    bookingUid: responseData.data?.uid,
  };
}

/**
 * Get available slots for a specific event type
 */
export async function getAvailableSlots(
  clientId: string, 
  eventTypeId: string, 
  startTime: string, 
  endTime: string,
  timeZone: string = 'America/New_York'
) {
  const tokenData = await getAndRefreshTokens(clientId);

  if (!tokenData) {
    throw new Error("Calendar not connected or token refresh failed.");
  }

  const params = new URLSearchParams({
    eventTypeId,
    startTime,
    endTime,
    timeZone,
  });

  const response = await fetch(`https://api.cal.com/v2/slots/available?${params}`, {
    headers: {
      'Authorization': `Bearer ${tokenData.accessToken}`,
      'cal-api-version': '2024-08-13',
    },
  });

  const responseData = await response.json();

  if (!response.ok) {
    const msg = responseData?.error?.message || 'Unknown error';
    console.error('[calCalendarService] Get slots failed:', responseData);

    if (response.status === 401 || response.status === 403) {
      const reason = responseData?.error?.code || 'calendar_api_auth_error';
      await markNeedsReauth(clientId, reason, msg);
    }

    throw new Error(`Cal.com API Error: ${msg}`);
  }

  await markCalendarCallSuccess(clientId);

  return responseData.data?.slots || [];
}

export const CalCalendarService = {
  getAndRefreshTokens,
  createCalBooking,
  getAvailableSlots,
  markCalendarCallSuccess,
};
