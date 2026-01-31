import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

/**
 * Get AI Agent Settings
 * Returns agent settings for a client, plus recent webhook events and webhook URLs.
 */
serve(async (req) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        const body = await req.json();
        const { client_id } = body;

        if (!client_id) {
            return errorResponse('Missing required field: client_id', 400);
        }

        console.log(`[get-agent-settings] Fetching settings for client ${client_id}`);

        // Get agent settings
        const { data: settings, error: settingsError } = await supabaseAdmin
            .from('ai_agent_settings')
            .select('*')
            .eq('client_id', client_id)
            .maybeSingle();

        if (settingsError) {
            console.error('[get-agent-settings] Fetch failed:', settingsError);
            return errorResponse(`Failed to fetch settings: ${settingsError.message}`, 500);
        }

        // Get recent webhook events for this client
        const { data: recentEvents, error: eventsError } = await supabaseAdmin
            .from('webhook_events')
            .select('id, event_type, event_source, external_id, status, error_message, duration_ms, created_at')
            .eq('client_id', client_id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (eventsError) {
            console.error('[get-agent-settings] Events fetch failed:', eventsError);
        }

        // Check Google Calendar connection status
        const { data: calendarStatus } = await supabaseAdmin
            .from('client_google_calendar')
            .select('connection_status, calendar_id, last_synced_at')
            .eq('client_id', client_id)
            .maybeSingle();

        // Check voice integration status
        const { data: voiceStatus } = await supabaseAdmin
            .from('client_voice_integrations')
            .select('retell_agent_id, voice_status, phone_number')
            .eq('client_id', client_id)
            .maybeSingle();

        // Generate webhook URLs
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const webhookBaseUrl = supabaseUrl ? `${supabaseUrl}/functions/v1` : null;

        return jsonResponse({
            settings: settings || null,
            recent_events: recentEvents || [],
            integrations: {
                google_calendar: calendarStatus ? {
                    connected: calendarStatus.connection_status === 'connected',
                    calendar_id: calendarStatus.calendar_id,
                    last_synced: calendarStatus.last_synced_at,
                } : { connected: false },
                retell: voiceStatus ? {
                    configured: !!voiceStatus.retell_agent_id,
                    agent_id: voiceStatus.retell_agent_id,
                    voice_status: voiceStatus.voice_status,
                    phone_number: voiceStatus.phone_number,
                } : { configured: false },
            },
            webhook_urls: webhookBaseUrl ? {
                retell_webhook: `${webhookBaseUrl}/retell-webhook`,
                check_availability: `${webhookBaseUrl}/check-availability`,
                book_meeting: `${webhookBaseUrl}/book-meeting`,
            } : null,
        });

    } catch (error: any) {
        console.error('[get-agent-settings] Error:', error.message);
        return errorResponse(error.message, 500);
    }
});
