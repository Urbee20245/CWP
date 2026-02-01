import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { decryptSecret, encryptSecret } from './encryption.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("[googleCalendarService] CRITICAL: Google secrets are missing.");
}

// Initialize Supabase Admin client for privileged DB access
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface TokenData {
  accessToken: string;
  refreshToken: string;
  calendarId: string;
}

interface EventDetails {
  title: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  description: string;
  attendeeEmail?: string;
  timeZone?: string;
}

async function markNeedsReauth(clientId: string, reason: string, message?: string) {
  try {
    await supabaseAdmin
      .from('client_google_calendar')
      .update({
        connection_status: 'needs_reauth',
        reauth_reason: reason,
        last_error: message || null,
        refresh_token_present: false,
      })
      .eq('client_id', clientId);
  } catch (e: any) {
    console.error('[googleCalendarService] Failed to mark needs_reauth:', e?.message);
  }
}

async function markConnectedOk(clientId: string) {
  try {
    await supabaseAdmin
      .from('client_google_calendar')
      .update({
        connection_status: 'connected',
        reauth_reason: null,
        last_error: null,
        refresh_token_present: true,
      })
      .eq('client_id', clientId);
  } catch (e: any) {
    console.error('[googleCalendarService] Failed to clear reauth flags:', e?.message);
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
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;

  const { data: config, error: fetchError } = await supabaseAdmin
    .from('client_google_calendar')
    .select('google_access_token, google_refresh_token, calendar_id, connection_status, refresh_token_present, access_token_expires_at')
    .eq('client_id', clientId)
    .maybeSingle();

  if (fetchError || !config) {
    console.log(`[googleCalendarService] No calendar config found for client ${clientId}`);
    return null;
  }

  if (config.connection_status !== 'connected') {
    console.log(`[googleCalendarService] Calendar not connected for client ${clientId} (status=${config.connection_status})`);
    return null;
  }

  const refreshTokenCipher = config.google_refresh_token || '';
  const refreshTokenPresent = !!(config.refresh_token_present && refreshTokenCipher.trim());
  if (!refreshTokenPresent) {
    console.warn(`[googleCalendarService] Connected row is missing refresh token for client ${clientId}. Marking needs_reauth.`);
    await markNeedsReauth(clientId, 'missing_refresh_token', 'Refresh token missing.');
    return null;
  }

  let accessToken = '';
  let refreshToken = '';
  try {
    refreshToken = await decryptSecret(refreshTokenCipher);
  } catch (e: any) {
    console.error('[googleCalendarService] Refresh token decrypt failed:', e?.message);
    await markNeedsReauth(clientId, 'decrypt_failed', 'Failed to decrypt refresh token.');
    return null;
  }

  // If access token is missing/invalid or expired, refresh it.
  const mustRefresh = !config.google_access_token?.trim() || isExpired(config.access_token_expires_at);

  if (mustRefresh) {
    console.log(`[googleCalendarService] Access token missing/expired for ${clientId}. Refreshing...`);

    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const refreshText = await refreshResponse.text();
    let refreshData: any = null;
    try { refreshData = JSON.parse(refreshText); } catch { /* ignore */ }

    if (!refreshResponse.ok || refreshData?.error) {
      const msg = refreshData?.error_description || refreshData?.error || refreshText || 'Token refresh failed';
      console.error('[googleCalendarService] Token refresh failed:', msg);
      await markNeedsReauth(clientId, 'refresh_failed', msg);
      return null;
    }

    const newAccessToken: string = refreshData.access_token;
    const expiresIn: number | undefined = refreshData.expires_in;

    const newEncryptedAccessToken = await encryptSecret(newAccessToken);
    const nowIso = new Date().toISOString();
    const expiresAt = typeof expiresIn === 'number' && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    await supabaseAdmin
      .from('client_google_calendar')
      .update({
        google_access_token: newEncryptedAccessToken,
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
      accessToken = await decryptSecret(config.google_access_token);
    } catch (e: any) {
      console.error('[googleCalendarService] Access token decrypt failed:', e?.message);
      // Try a refresh; decrypt failure could be due to empty/garbled access token.
      await supabaseAdmin
        .from('client_google_calendar')
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
    calendarId: config.calendar_id || 'primary',
  };
}

/**
 * Creates a Google Calendar event for the client.
 */
export async function createCalendarEvent(clientId: string, eventDetails: EventDetails) {
  const tokenData = await getAndRefreshTokens(clientId);

  if (!tokenData) {
    throw new Error("Calendar not connected or token refresh failed.");
  }

  const timeZone = eventDetails.timeZone || 'America/New_York';

  const event = {
    summary: eventDetails.title,
    description: eventDetails.description,
    start: { dateTime: eventDetails.startTime, timeZone },
    end: { dateTime: eventDetails.endTime, timeZone },
    attendees: eventDetails.attendeeEmail ? [{ email: eventDetails.attendeeEmail }] : [],
    reminders: {
      useDefault: true,
    },
  };

  const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tokenData.calendarId)}/events`;

  const response = await fetch(calendarUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  const responseData = await response.json();

  if (!response.ok) {
    const msg = responseData?.error?.message || 'Unknown error';
    console.error('[googleCalendarService] Event creation failed:', responseData);

    if (response.status === 401 || response.status === 403) {
      const reason = responseData?.error?.status || responseData?.error?.errors?.[0]?.reason || 'calendar_api_auth_error';
      await markNeedsReauth(clientId, reason, msg);
    }

    throw new Error(`Google Calendar API Error: ${msg}`);
  }

  console.log(`[googleCalendarService] Event created successfully: ${responseData.htmlLink}`);
  return { success: true, eventLink: responseData.htmlLink };
}

export const GoogleCalendarService = {
  getAndRefreshTokens,
  createCalendarEvent,
};