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

/**
 * Fetches and decrypts tokens, refreshing the access token if necessary.
 * @param clientId The ID of the client whose tokens are needed.
 * @returns TokenData object or null if disconnected/failed.
 */
async function getAndRefreshTokens(clientId: string): Promise<TokenData | null> {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;

    const { data: config, error: fetchError } = await supabaseAdmin
        .from('client_google_calendar')
        .select('google_access_token, google_refresh_token, calendar_id, updated_at, connection_status')
        .eq('client_id', clientId)
        .eq('connection_status', 'connected')
        .maybeSingle();

    if (fetchError || !config) {
        console.log(`[googleCalendarService] No active connection found for client ${clientId}`);
        return null;
    }

    const accessToken = await decryptSecret(config.google_access_token);
    const refreshToken = await decryptSecret(config.google_refresh_token);
    
    // Check if token needs refreshing (assuming tokens expire hourly, check if updated_at is > 50 minutes ago)
    const lastUpdated = new Date(config.updated_at);
    const now = new Date();
    const minutesSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);

    if (minutesSinceUpdate > 50) {
        console.log(`[googleCalendarService] Access token for ${clientId} expired. Refreshing...`);
        
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

        const refreshData = await refreshResponse.json();

        if (refreshData.error) {
            console.error('[googleCalendarService] Token refresh failed:', refreshData.error_description);
            // Mark as disconnected if refresh fails
            await supabaseAdmin.from('client_google_calendar').update({ connection_status: 'disconnected' }).eq('client_id', clientId);
            return null;
        }

        const newAccessToken = refreshData.access_token;
        const newEncryptedAccessToken = await encryptSecret(newAccessToken);

        // Update DB with new access token and timestamp
        await supabaseAdmin
            .from('client_google_calendar')
            .update({
                google_access_token: newEncryptedAccessToken,
                last_synced_at: now.toISOString(),
            })
            .eq('client_id', clientId);
            
        return { accessToken: newAccessToken, refreshToken, calendarId: config.calendar_id };
    }

    return { accessToken, refreshToken, calendarId: config.calendar_id };
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

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${tokenData.calendarId}/events`;

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
        console.error('[googleCalendarService] Event creation failed:', responseData);
        throw new Error(`Google Calendar API Error: ${responseData.error?.message || 'Unknown error'}`);
    }

    console.log(`[googleCalendarService] Event created successfully: ${responseData.htmlLink}`);
    return { success: true, eventLink: responseData.htmlLink };
}

// Export the token management function for future n8n compatibility
export const GoogleCalendarService = {
    getAndRefreshTokens,
    createCalendarEvent,
};