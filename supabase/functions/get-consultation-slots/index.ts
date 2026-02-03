import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CalCalendarService } from '../_shared/calCalendarService.ts';

/**
 * Get Consultation Slots - Public endpoint for the consultation form
 * Fetches available Cal.com slots for the admin's calendar
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Parse query params for date range (optional)
    const url = new URL(req.url);
    const daysAhead = Math.min(parseInt(url.searchParams.get('days') || '14'), 30);
    const timezone = url.searchParams.get('timezone') || 'America/New_York';

    // Find the admin profile
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    if (adminError || !adminProfile) {
      console.error('[get-consultation-slots] Admin profile not found:', adminError);
      return jsonResponse({ error: 'Configuration error', slots: [] }, 500);
    }

    // Find the admin's client record
    const { data: adminClient, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('owner_profile_id', adminProfile.id)
      .limit(1)
      .single();

    if (clientError || !adminClient) {
      console.error('[get-consultation-slots] Admin client not found:', clientError);
      return jsonResponse({ error: 'Configuration error', slots: [] }, 500);
    }

    const clientId = adminClient.id;

    // Check Cal.com connection
    const { data: calConn } = await supabaseAdmin
      .from('client_cal_calendar')
      .select('connection_status, refresh_token_present, default_event_type_id')
      .eq('client_id', clientId)
      .maybeSingle();

    const calUsable = !!(
      calConn &&
      calConn.connection_status === 'connected' &&
      calConn.refresh_token_present === true &&
      calConn.default_event_type_id &&
      String(calConn.default_event_type_id).trim()
    );

    if (!calUsable) {
      console.error('[get-consultation-slots] Cal.com not configured for admin');
      return jsonResponse({
        error: 'Calendar not configured',
        slots: [],
        message: 'Online scheduling is temporarily unavailable. Please call us to schedule.'
      }, 200);
    }

    // Calculate time range
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setHours(0, 0, 0, 0);
    // Start from tomorrow if it's late in the day
    if (now.getHours() >= 17) {
      timeMin.setDate(timeMin.getDate() + 1);
    }

    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + daysAhead);
    timeMax.setHours(23, 59, 59, 999);

    console.log(`[get-consultation-slots] Fetching slots for client ${clientId}, event type ${calConn.default_event_type_id}`);

    // Fetch available slots from Cal.com
    const slots = await CalCalendarService.getAvailableSlots(
      clientId,
      String(calConn.default_event_type_id),
      timeMin.toISOString(),
      timeMax.toISOString(),
      timezone
    );

    // Format slots for the frontend
    const formattedSlots: Array<{
      date: string;
      dateFormatted: string;
      time: string;
      datetime: string;
    }> = [];

    // Cal.com returns slots grouped by date or as flat array
    if (Array.isArray(slots)) {
      for (const slot of slots) {
        const isoTime = typeof slot === 'string' ? slot : slot?.time || slot?.start;
        if (!isoTime) continue;

        const d = new Date(isoTime);
        if (isNaN(d.getTime())) continue;

        // Format date as YYYY-MM-DD for grouping
        const dateKey = d.toISOString().split('T')[0];

        // Format date for display
        const dateFormatted = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          timeZone: timezone,
        });

        // Format time for display
        const timeFormatted = d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: timezone,
        });

        formattedSlots.push({
          date: dateKey,
          dateFormatted,
          time: timeFormatted,
          datetime: d.toISOString(),
        });
      }
    } else if (typeof slots === 'object' && slots !== null) {
      // Handle object format: { "2024-01-15": [{time: "..."}] }
      for (const [dateKey, daySlots] of Object.entries(slots)) {
        if (!Array.isArray(daySlots)) continue;

        for (const slot of daySlots) {
          const isoTime = typeof slot === 'string' ? slot : slot?.time || slot?.start;
          if (!isoTime) continue;

          const d = new Date(isoTime);
          if (isNaN(d.getTime())) continue;

          const dateFormatted = d.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone: timezone,
          });

          const timeFormatted = d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: timezone,
          });

          formattedSlots.push({
            date: dateKey,
            dateFormatted,
            time: timeFormatted,
            datetime: d.toISOString(),
          });
        }
      }
    }

    console.log(`[get-consultation-slots] Returning ${formattedSlots.length} slots`);

    return jsonResponse({
      success: true,
      slots: formattedSlots,
      timezone,
      daysAhead,
    });

  } catch (error: any) {
    console.error('[get-consultation-slots] Error:', error.message);
    return jsonResponse({
      error: 'Failed to fetch available times',
      slots: [],
      message: 'Online scheduling is temporarily unavailable. Please call us to schedule.'
    }, 200);
  }
});
