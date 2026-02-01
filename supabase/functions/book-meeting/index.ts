import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { GoogleCalendarService } from '../_shared/googleCalendarService.ts';
import { handleCors, jsonResponse } from '../_shared/utils.ts';

/**
 * Book Meeting - Retell Custom Function
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

    console.log(`[book-meeting] Request from agent ${agentId}, call ${callId}`, args);

    if (!agentId) {
      return jsonResponse({ result: 'I encountered an issue booking. Let me take your information instead.' }, 400);
    }

    const selectedDatetime = args.datetime || null;
    const callerName = args.caller_name || args.name || 'Unknown Caller';
    const callerPhone = args.caller_phone || args.phone || null;
    const callerEmail = args.caller_email || args.email || null;
    const meetingType = args.meeting_type || 'phone';
    const meetingNotes = args.notes || '';

    if (!selectedDatetime) {
      return jsonResponse({
        result: 'I need a specific date and time to book. Could you tell me which time slot you prefer?',
      });
    }

    let clientId: string | null = null;

    const { data: agentRow, error: agentRowError } = await supabaseAdmin
      .from('ai_agent_settings')
      .select('client_id')
      .eq('retell_agent_id', agentId)
      .maybeSingle();

    if (agentRowError) {
      console.error('[book-meeting] ai_agent_settings lookup failed:', agentRowError);
    }

    clientId = agentRow?.client_id || null;

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
        result: 'I am unable to complete the booking right now. Please leave your number and someone will call you back to schedule.',
      });
    }

    const { data: agentSettings } = await supabaseAdmin
      .from('ai_agent_settings')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();

    if (agentSettings && !agentSettings.can_book_meetings) {
      return jsonResponse({
        result: 'Booking is not available at this time. Let me take your information and someone will reach out.',
      });
    }

    const meetingDuration = agentSettings?.default_meeting_duration || 30;
    const timezone = agentSettings?.timezone || 'America/New_York';

    const appointmentTime = new Date(selectedDatetime);
    if (isNaN(appointmentTime.getTime())) {
      return jsonResponse({
        result: 'I had trouble understanding that time. Could you specify the date and time again?',
      });
    }

    if (appointmentTime < new Date()) {
      return jsonResponse({
        result: 'That time has already passed. Would you like to pick a different time?',
      });
    }

    const endTime = new Date(appointmentTime.getTime() + meetingDuration * 60 * 1000);

    const tokenData = await GoogleCalendarService.getAndRefreshTokens(clientId);

    if (tokenData) {
      const freeBusyResponse = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: appointmentTime.toISOString(),
          timeMax: endTime.toISOString(),
          timeZone: timezone,
          items: [{ id: tokenData.calendarId || 'primary' }],
        }),
      });

      const freeBusyData = await freeBusyResponse.json();

      if (!freeBusyResponse.ok) {
        console.error('[book-meeting] Free/busy API error:', freeBusyData);

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
        // Continue without calendar check
      } else {
        await GoogleCalendarService.markCalendarCallSuccess(clientId);

        const calendarId = tokenData.calendarId || 'primary';
        const busyPeriods = freeBusyData.calendars?.[calendarId]?.busy || [];

        if (busyPeriods.length > 0) {
          return jsonResponse({
            result: 'It looks like that time slot was just taken. Would you like to check availability again for another time?',
          });
        }
      }
    }

    const { data: conflictingAppts } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'scheduled')
      .gte('appointment_time', new Date(appointmentTime.getTime() - meetingDuration * 60 * 1000).toISOString())
      .lte('appointment_time', endTime.toISOString())
      .limit(1);

    if (conflictingAppts && conflictingAppts.length > 0) {
      return jsonResponse({
        result: 'That time slot is no longer available. Would you like me to check for other available times?',
      });
    }

    let googleEventId: string | null = null;

    if (tokenData) {
      try {
        const eventResult = await GoogleCalendarService.createCalendarEvent(clientId, {
          title: `Meeting with ${callerName}`,
          description: [
            `Booked by AI Agent via phone call`,
            `Caller: ${callerName}`,
            callerPhone ? `Phone: ${callerPhone}` : '',
            callerEmail ? `Email: ${callerEmail}` : '',
            meetingNotes ? `Notes: ${meetingNotes}` : '',
            `Type: ${meetingType}`,
            callId ? `Retell Call ID: ${callId}` : '',
          ].filter(Boolean).join('\n'),
          startTime: appointmentTime.toISOString(),
          endTime: endTime.toISOString(),
          attendeeEmail: callerEmail || undefined,
          timeZone: timezone,
        });

        if (eventResult?.eventLink) {
          const eventIdMatch = eventResult.eventLink.match(/eid=([^&]+)/);
          googleEventId = eventIdMatch ? eventIdMatch[1] : null;
        }

        console.log(`[book-meeting] Calendar event created: ${eventResult.eventLink}`);
      } catch (calError: any) {
        console.error('[book-meeting] Calendar event creation failed:', calError.message);
      }
    }

    const { data: appointment, error: apptError } = await supabaseAdmin
      .from('appointments')
      .insert({
        client_id: clientId,
        appointment_time: appointmentTime.toISOString(),
        duration_minutes: meetingDuration,
        appointment_type: meetingType,
        status: 'scheduled',
        caller_name: callerName,
        caller_phone: callerPhone,
        caller_email: callerEmail,
        meeting_notes: meetingNotes,
        booked_by: 'ai_agent',
        retell_call_id: callId,
        google_event_id: googleEventId,
      })
      .select('id')
      .single();

    if (apptError) {
      console.error('[book-meeting] Appointment insert failed:', apptError);
      return jsonResponse({
        result: 'I was able to add it to the calendar but had trouble with our records. The appointment is confirmed though.',
      });
    }

    const { data: clientData } = await supabaseAdmin
      .from('clients')
      .select('business_name')
      .eq('id', clientId)
      .single();

    const businessName = clientData?.business_name || 'us';

    await supabaseAdmin
      .from('webhook_events')
      .insert({
        client_id: clientId,
        event_type: 'retell.book_meeting',
        event_source: 'retell',
        agent_id: agentId,
        retell_call_id: callId,
        external_id: callId,
        request_payload: { agent_id: agentId, args },
        response_payload: {
          appointment_id: appointment.id,
          google_event_id: googleEventId,
          datetime: appointmentTime.toISOString(),
        },
        status: 'completed',
        duration_ms: Date.now() - startTime,
      });

    const dateStr = appointmentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    });
    const timeStr = appointmentTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });

    return jsonResponse({
      result: `Your ${meetingType} appointment with ${businessName} has been booked for ${dateStr} at ${timeStr}. The meeting is ${meetingDuration} minutes. Is there anything else I can help you with?`,
      appointment_id: appointment.id,
      google_event_id: googleEventId,
    });

  } catch (error: any) {
    console.error(`[book-meeting] Error: ${error.message}`);
    return jsonResponse({
      result: 'I ran into an issue completing the booking. Let me take your information and someone will confirm the appointment with you.',
    });
  }
});