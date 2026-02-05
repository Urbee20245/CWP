import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { GoogleCalendarService } from '../_shared/googleCalendarService.ts';
import { CalCalendarService } from '../_shared/calCalendarService.ts';
import { handleCors, jsonResponse } from '../_shared/utils.ts';

/**
 * Check Availability - Retell Custom Function
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json();

    const agentId = body.agent_id || null;
    const callId = body.call_id || null;
    const args = body.args || {};

    console.log(`[check-availability] Request from agent ${agentId}, call ${callId}`);

    if (!agentId) {
      return jsonResponse({ error: 'Missing agent_id' }, 400);
    }

    const { data: agentRow, error: agentRowError } = await supabaseAdmin
      .from('ai_agent_settings')
      .select('client_id')
      .eq('retell_agent_id', agentId)
      .maybeSingle();

    if (agentRowError) {
      console.error('[check-availability] ai_agent_settings lookup failed:', agentRowError);
    }

    let clientId = agentRow?.client_id || null;

    if (!clientId) {
      const { data: voiceData } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('client_id')
        .eq('retell_agent_id', agentId)
        .maybeSingle();

      clientId = voiceData?.client_id || null;
    }

    if (!clientId) {
      return jsonResponse({
        result: 'I apologize, but I am unable to check availability right now. Please call back or leave your contact information.',
      });
    }

    const { data: agentSettings } = await supabaseAdmin
      .from('ai_agent_settings')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();

    if (agentSettings && agentSettings.can_check_availability === false) {
      return jsonResponse({
        result: 'Availability checking is not enabled right now. Please leave your contact information and someone will reach out to schedule.',
      });
    }

    const calendarProvider: 'none' | 'cal' | 'google' = (agentSettings?.calendar_provider || 'none');

    const meetingDuration = agentSettings?.default_meeting_duration || 30;
    const bufferMinutes = agentSettings?.booking_buffer_minutes ?? 0;
    const maxAdvanceDays = agentSettings?.max_advance_booking_days || 60;
    const businessHours = agentSettings?.business_hours || {
      "1": { "start": "09:00", "end": "17:00" },
      "2": { "start": "09:00", "end": "17:00" },
      "3": { "start": "09:00", "end": "17:00" },
      "4": { "start": "09:00", "end": "17:00" },
      "5": { "start": "09:00", "end": "17:00" },
    };
    const timezone = agentSettings?.timezone || 'America/New_York';

    const requestedDate = args.date || null;
    const daysAhead = Math.min(args.days_ahead || 3, maxAdvanceDays);

    const now = new Date();
    let checkStartDate: Date;

    if (requestedDate) {
      const parsed = new Date(requestedDate);
      checkStartDate = !isNaN(parsed.getTime()) ? parsed : now;
    } else {
      checkStartDate = now;
    }

    const timeMin = new Date(checkStartDate);
    timeMin.setHours(0, 0, 0, 0);
    if (timeMin.toDateString() === now.toDateString()) {
      timeMin.setTime(now.getTime());
    }

    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + daysAhead);
    timeMax.setHours(23, 59, 59, 999);

    let availableSlots: { date: string; time: string; datetime: string }[] = [];

    if (calendarProvider === 'none') {
      return jsonResponse({
        result: 'Calendar booking has not been configured yet. Please leave your contact information and someone will reach out to schedule.',
      });
    }

    if (calendarProvider === 'cal') {
      const { data: calConn } = await supabaseAdmin
        .from('client_cal_calendar')
        .select('connection_status, refresh_token_present, default_event_type_id, auth_method')
        .eq('client_id', clientId)
        .maybeSingle();

      const calUsable = !!(
        calConn &&
        calConn.connection_status === 'connected' &&
        (calConn.auth_method === 'api_key' || calConn.refresh_token_present === true) &&
        calConn.default_event_type_id &&
        String(calConn.default_event_type_id).trim()
      );

      if (!calUsable) {
        return jsonResponse({
          result: 'Cal.com is selected for booking, but it is not connected (or missing an Event Type). Please connect Cal.com in settings and try again.',
        });
      }

      const slots = await CalCalendarService.getAvailableSlots(
        clientId,
        String(calConn.default_event_type_id),
        timeMin.toISOString(),
        timeMax.toISOString(),
        timezone,
      );

      const flattened: string[] = [];
      if (Array.isArray(slots)) {
        for (const s of slots) {
          if (typeof s === 'string') flattened.push(s);
          else if (s?.start) flattened.push(String(s.start));
        }
      }

      availableSlots = flattened.slice(0, 10).map((iso) => {
        const d = new Date(iso);
        const dateStr = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          timeZone: timezone,
        });
        const timeStr = d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: timezone,
        });
        return { date: dateStr, time: timeStr, datetime: d.toISOString() };
      });
    }

    if (calendarProvider === 'google') {
      const tokenData = await GoogleCalendarService.getAndRefreshTokens(clientId);

      if (!tokenData) {
        return jsonResponse({
          result: 'Google Calendar is selected for booking, but it is not connected. Please connect Google Calendar in settings and try again.',
        });
      }

      const freeBusyUrl = 'https://www.googleapis.com/calendar/v3/freeBusy';
      const freeBusyResponse = await fetch(freeBusyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          timeZone: timezone,
          items: [{ id: tokenData.calendarId || 'primary' }],
        }),
      });

      const freeBusyData = await freeBusyResponse.json();

      if (!freeBusyResponse.ok) {
        console.error('[check-availability] Free/busy API error:', freeBusyData);

        if (freeBusyResponse.status === 401 || freeBusyResponse.status === 403) {
          const reason = freeBusyData?.error?.errors?.[0]?.reason || freeBusyData?.error?.status || 'calendar_api_auth_error';
          const message = freeBusyData?.error?.message || 'Calendar API authorization failed.';
          await supabaseAdmin
            .from('client_google_calendar')
            .update({
              connection_status: 'needs_reauth',
              reauth_reason: reason,
              last_error: message,
            })
            .eq('client_id', clientId);
        }

        return jsonResponse({
          result: 'I am having trouble checking the calendar right now. Can I take your number and have someone call you back?',
        });
      }

      // Mark success for diagnostics
      await GoogleCalendarService.markCalendarCallSuccess(clientId);

      const calendarId = tokenData.calendarId || 'primary';
      const busyPeriods = freeBusyData.calendars?.[calendarId]?.busy || [];

      const { data: existingAppts } = await supabaseAdmin
        .from('appointments')
        .select('appointment_time, duration_minutes')
        .eq('client_id', clientId)
        .eq('status', 'scheduled')
        .gte('appointment_time', timeMin.toISOString())
        .lte('appointment_time', timeMax.toISOString());

      const allBusyPeriods = [
        ...busyPeriods.map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) })),
        ...(existingAppts || []).map((a: any) => ({
          start: new Date(a.appointment_time),
          end: new Date(new Date(a.appointment_time).getTime() + (a.duration_minutes || 30) * 60 * 1000),
        })),
      ];

      for (let dayOffset = 0; dayOffset < daysAhead && availableSlots.length < 10; dayOffset++) {
        const checkDate = new Date(timeMin);
        checkDate.setDate(timeMin.getDate() + dayOffset);
        checkDate.setHours(0, 0, 0, 0);

        const dayOfWeek = checkDate.getDay().toString();
        const dayHours = businessHours[dayOfWeek];
        if (!dayHours) continue;

        const [startHour, startMin] = dayHours.start.split(':').map(Number);
        const [endHour, endMin] = dayHours.end.split(':').map(Number);

        const dayStart = new Date(checkDate);
        dayStart.setHours(startHour, startMin, 0, 0);

        const dayEnd = new Date(checkDate);
        dayEnd.setHours(endHour, endMin, 0, 0);

        let slotStart = new Date(dayStart);
        if (slotStart < now) {
          const msSinceDay = now.getTime() - dayStart.getTime();
          const slotMs = (meetingDuration + bufferMinutes) * 60 * 1000;
          const slotsElapsed = Math.ceil(msSinceDay / slotMs);
          slotStart = new Date(dayStart.getTime() + slotsElapsed * slotMs);
        }

        while (slotStart.getTime() + meetingDuration * 60 * 1000 <= dayEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + meetingDuration * 60 * 1000);

          const hasConflict = allBusyPeriods.some((busy: { start: Date; end: Date }) => {
            const busyStart = busy.start instanceof Date ? busy.start : new Date(busy.start);
            const busyEnd = busy.end instanceof Date ? busy.end : new Date(busy.end);
            return slotStart < busyEnd && slotEnd > busyStart;
          });

          if (!hasConflict) {
            const dateStr = slotStart.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              timeZone: timezone,
            });
            const timeStr = slotStart.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: timezone,
            });

            availableSlots.push({
              date: dateStr,
              time: timeStr,
              datetime: slotStart.toISOString(),
            });
          }

          slotStart = new Date(slotStart.getTime() + (meetingDuration + bufferMinutes) * 60 * 1000);
          if (availableSlots.length >= 10) break;
        }
      }
    }

    await supabaseAdmin
      .from('webhook_events')
      .insert({
        client_id: clientId,
        event_type: 'retell.check_availability',
        event_source: 'retell',
        agent_id: agentId,
        retell_call_id: callId,
        external_id: callId,
        request_payload: { agent_id: agentId, args },
        response_payload: { slots_found: availableSlots.length, provider: calendarProvider },
        status: 'completed',
        duration_ms: Date.now() - startTime,
      });

    if (availableSlots.length === 0) {
      return jsonResponse({
        result: `There are no available slots in the next ${daysAhead} days. Would you like to leave your contact information so someone can reach out to schedule?`,
      });
    }

    const slotDescriptions = availableSlots
      .slice(0, 5)
      .map((s) => `${s.date} at ${s.time}`)
      .join(', ');

    return jsonResponse({
      result: `Here are the available times: ${slotDescriptions}. Which time works best for you?`,
      available_slots: availableSlots,
    });

  } catch (error: any) {
    console.error(`[check-availability] Error: ${error.message}`);
    return jsonResponse({
      result: 'I am having trouble checking availability. Can I take your information and have someone follow up?',
    });
  }
});