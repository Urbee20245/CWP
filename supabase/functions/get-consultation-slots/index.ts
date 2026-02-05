export const config = {
  auth: false,
};

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

async function safeReadJson(req: Request): Promise<any | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
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
    const body = await safeReadJson(req);

    const daysParam = url.searchParams.get('days') ?? body?.days;
    const tzParam = url.searchParams.get('timezone') ?? body?.timezone;

    const daysAhead = Math.min(parseInt(String(daysParam ?? '14')), 30);
    const timezone = String(tzParam ?? 'America/New_York');

    // Determine which Cal.com config to use.
    // Primary: the "admin" profile's linked client (owner_profile_id)
    // Fallback: any connected Cal.com client (most recently updated)

    let clientId: string | null = null;

    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (adminError) {
      console.error('[get-consultation-slots] Failed to query admin profile:', adminError);
    }

    if (adminProfile?.id) {
      const { data: adminClient, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('owner_profile_id', adminProfile.id)
        .limit(1)
        .maybeSingle();

      if (clientError) {
        console.error('[get-consultation-slots] Failed to query admin client:', clientError);
      }

      if (adminClient?.id) {
        clientId = adminClient.id;
      }
    }

    if (!clientId) {
      console.warn('[get-consultation-slots] No admin-linked client found. Falling back to any connected Cal.com client.');
      const { data: fallbackCal, error: fallbackErr } = await supabaseAdmin
        .from('client_cal_calendar')
        .select('client_id, default_event_type_id')
        .eq('connection_status', 'connected')
        .or('refresh_token_present.eq.true,auth_method.eq.api_key')
        .not('default_event_type_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackErr) {
        console.error('[get-consultation-slots] Failed to query fallback Cal.com config:', fallbackErr);
      }

      if (fallbackCal?.client_id) {
        clientId = fallbackCal.client_id;
      }
    }

    if (!clientId) {
      console.error('[get-consultation-slots] No suitable Cal.com configuration found.');
      return jsonResponse({
        success: true,
        slots: [],
        message: 'Online scheduling is temporarily unavailable. Please call us to schedule.',
      });
    }

    // Check Cal.com connection
    const { data: calConn, error: calErr } = await supabaseAdmin
      .from('client_cal_calendar')
      .select('connection_status, refresh_token_present, default_event_type_id, auth_method')
      .eq('client_id', clientId)
      .maybeSingle();

    if (calErr) {
      console.error('[get-consultation-slots] Failed to read Cal.com connection:', calErr);
    }

    const calUsable = !!(
      calConn &&
      calConn.connection_status === 'connected' &&
      (calConn.auth_method === 'api_key' || calConn.refresh_token_present === true) &&
      calConn.default_event_type_id &&
      String(calConn.default_event_type_id).trim()
    );

    if (!calUsable) {
      console.error('[get-consultation-slots] Cal.com not configured (or needs re-auth) for selected client:', {
        clientId,
        connection_status: calConn?.connection_status,
        refresh_token_present: calConn?.refresh_token_present,
        default_event_type_id: calConn?.default_event_type_id,
      });

      return jsonResponse({
        success: true,
        slots: [],
        message: 'Online scheduling is temporarily unavailable. Please call us to schedule.',
      });
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

        const dateKey = d.toISOString().split('T')[0];

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
    } else if (typeof slots === 'object' && slots !== null) {
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
      success: true,
      slots: [],
      message: 'Online scheduling is temporarily unavailable. Please call us to schedule.',
    });
  }
});