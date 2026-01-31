import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { GoogleCalendarService } from '../_shared/googleCalendarService.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

/**
 * Check Availability - Retell Custom Function
 *
 * Called by Retell AI agent mid-conversation when a caller wants to book.
 * Queries the client's Google Calendar for free/busy times and returns
 * available slots the agent can offer to the caller.
 *
 * Retell sends: { agent_id, call_id, args: { date?, days_ahead? } }
 * We return: { available_slots: [...] } for the agent to read back
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

        // Retell custom function format
        const agentId = body.agent_id || null;
        const callId = body.call_id || null;
        const args = body.args || {};

        console.log(`[check-availability] Request from agent ${agentId}, call ${callId}`);

        // 1. Resolve client from agent_id
        if (!agentId) {
            return jsonResponse({ error: 'Missing agent_id' }, 400);
        }

        // Prefer ai_agent_settings.retell_agent_id
        const { data: agentRow, error: agentRowError } = await supabaseAdmin
            .from('ai_agent_settings')
            .select('client_id')
            .eq('retell_agent_id', agentId)
            .maybeSingle();

        if (agentRowError) {
            console.error('[check-availability] ai_agent_settings lookup failed:', agentRowError);
        }

        let clientId = agentRow?.client_id || null;

        // Fallback to client_voice_integrations.retell_agent_id
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

        // 2. Get agent settings for this client
        const { data: agentSettings } = await supabaseAdmin
            .from('ai_agent_settings')
            .select('*')
            .eq('client_id', clientId)
            .eq('is_active', true)
            .maybeSingle();

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

        // 3. Get Google Calendar tokens
        const tokenData = await GoogleCalendarService.getAndRefreshTokens(clientId);

        if (!tokenData) {
            return jsonResponse({
                result: 'Calendar is not currently connected. Please leave your contact information and someone will reach out to schedule.',
            });
        }

        // 4. Determine date range to check
        const requestedDate = args.date || null; // "2026-02-03" or "tomorrow" etc.
        const daysAhead = Math.min(args.days_ahead || 3, maxAdvanceDays);

        const now = new Date();
        let checkStartDate: Date;

        if (requestedDate) {
            // Try to parse the requested date
            const parsed = new Date(requestedDate);
            if (!isNaN(parsed.getTime())) {
                checkStartDate = parsed;
            } else {
                checkStartDate = now;
            }
        } else {
            checkStartDate = now;
        }

        // Set time range: from start of checkStartDate to daysAhead days later
        const timeMin = new Date(checkStartDate);
        timeMin.setHours(0, 0, 0, 0);
        // If checking today, start from now
        if (timeMin.toDateString() === now.toDateString()) {
            timeMin.setTime(now.getTime());
        }

        const timeMax = new Date(timeMin);
        timeMax.setDate(timeMax.getDate() + daysAhead);
        timeMax.setHours(23, 59, 59, 999);

        // 5. Query Google Calendar free/busy API
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
            return jsonResponse({
                result: 'I am having trouble checking the calendar right now. Can I take your number and have someone call you back?',
            });
        }

        // 6. Extract busy periods
        const calendarId = tokenData.calendarId || 'primary';
        const busyPeriods = freeBusyData.calendars?.[calendarId]?.busy || [];

        // 7. Also get existing appointments from our DB
        const { data: existingAppts } = await supabaseAdmin
            .from('appointments')
            .select('appointment_time, duration_minutes')
            .eq('client_id', clientId)
            .eq('status', 'scheduled')
            .gte('appointment_time', timeMin.toISOString())
            .lte('appointment_time', timeMax.toISOString());

        // Merge DB appointments into busy periods
        const allBusyPeriods = [
            ...busyPeriods.map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) })),
            ...(existingAppts || []).map((a: any) => ({
                start: new Date(a.appointment_time),
                end: new Date(new Date(a.appointment_time).getTime() + (a.duration_minutes || 30) * 60 * 1000),
            })),
        ];

        // 8. Generate available slots
        const availableSlots: { date: string; time: string; datetime: string }[] = [];

        for (let dayOffset = 0; dayOffset < daysAhead && availableSlots.length < 10; dayOffset++) {
            const checkDate = new Date(timeMin);
            checkDate.setDate(timeMin.getDate() + dayOffset);
            checkDate.setHours(0, 0, 0, 0);

            const dayOfWeek = checkDate.getDay().toString();
            const dayHours = businessHours[dayOfWeek];

            if (!dayHours) continue; // No business hours for this day

            const [startHour, startMin] = dayHours.start.split(':').map(Number);
            const [endHour, endMin] = dayHours.end.split(':').map(Number);

            const dayStart = new Date(checkDate);
            dayStart.setHours(startHour, startMin, 0, 0);

            const dayEnd = new Date(checkDate);
            dayEnd.setHours(endHour, endMin, 0, 0);

            // Generate slots in meetingDuration increments
            let slotStart = new Date(dayStart);
            // If today, skip past current time
            if (slotStart < now) {
                // Round up to next slot boundary
                const msSinceDay = now.getTime() - dayStart.getTime();
                const slotMs = (meetingDuration + bufferMinutes) * 60 * 1000;
                const slotsElapsed = Math.ceil(msSinceDay / slotMs);
                slotStart = new Date(dayStart.getTime() + slotsElapsed * slotMs);
            }

            while (slotStart.getTime() + meetingDuration * 60 * 1000 <= dayEnd.getTime()) {
                const slotEnd = new Date(slotStart.getTime() + meetingDuration * 60 * 1000);

                // Check if slot conflicts with any busy period
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

                // Move to next slot (duration + buffer)
                slotStart = new Date(slotStart.getTime() + (meetingDuration + bufferMinutes) * 60 * 1000);

                if (availableSlots.length >= 10) break;
            }
        }

        // 9. Log the webhook event
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
                response_payload: { slots_found: availableSlots.length },
                status: 'completed',
                duration_ms: Date.now() - startTime,
            });

        // 10. Return result for Retell agent
        if (availableSlots.length === 0) {
            return jsonResponse({
                result: `There are no available slots in the next ${daysAhead} days. Would you like to leave your contact information so someone can reach out to schedule?`,
            });
        }

        // Format slots for the agent to read naturally
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