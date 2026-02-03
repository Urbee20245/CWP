export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { sendPublicFormEmail } from '../_shared/publicEmailService.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { GoogleCalendarService } from '../_shared/googleCalendarService.ts';
import { CalCalendarService } from '../_shared/calCalendarService.ts';
import { parse, formatISO, addMinutes } from 'https://esm.sh/date-fns@3.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPPORT_EMAIL = 'support@customwebsiteplus.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    
    const {
      fullName,
      email,
      phone,
      message,
      formType = 'Contact Form',
      preferredDate,
      preferredTime,
      businessName,
      websiteUrl,
      industry,
      services,
      budget,
      timeline,
      projectDescription,
      alternateDate,
      alternateTime,
      referralSource,
      decisionMaker,
      selectedSlotDatetime,
    } = body

    if (!fullName || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- NEW: Initialize Supabase Admin Client ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const subject = `New ${formType}: ${fullName}`;

    const detailsText = [
      `Name: ${fullName}`,
      businessName ? `Business: ${businessName}` : null,
      `Email: ${email}`,
      `Phone: ${phone || 'Not provided'}`,
      websiteUrl ? `Website: ${websiteUrl}` : null,
      industry ? `Industry: ${industry}` : null,
      Array.isArray(services) && services.length > 0 ? `Services: ${services.join(', ')}` : null,
      budget ? `Budget: ${budget}` : null,
      timeline ? `Timeline: ${timeline}` : null,
      referralSource ? `Referral Source: ${referralSource}` : null,
      decisionMaker ? `Decision Maker: ${decisionMaker}` : null,
      preferredDate && preferredTime ? `Preferred Time: ${preferredDate} at ${preferredTime} ET` : null,
      alternateDate && alternateTime ? `Alternate Time: ${alternateDate} at ${alternateTime} ET` : null,
      '',
      'Message:',
      `${message}`,
      projectDescription && projectDescription !== message ? `\nProject Description:\n${projectDescription}` : null,
    ].filter(Boolean).join('\n');

    // --- Store incoming message in the database ---
    const { error: dbError } = await supabaseAdmin
      .from('incoming_emails')
      .insert({
        from_name: fullName,
        from_email: email,
        subject: subject,
        body: detailsText,
        status: 'unread'
      });

    if (dbError) {
      console.error('[submit-contact-form] Error saving incoming email to DB:', dbError.message);
      // Log the error but continue to send emails.
    }
    
    // --- Calendar Booking Creation ---
    let calendarBookingCreated = false;
    if (formType === 'Consultation Request') {
        try {
            const { data: adminProfile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('role', 'admin')
                .limit(1)
                .single();

            if (adminProfile) {
                const { data: adminClient } = await supabaseAdmin
                    .from('clients')
                    .select('id')
                    .eq('owner_profile_id', adminProfile.id)
                    .limit(1)
                    .single();

                if (adminClient) {
                    const targetClientId = adminClient.id;

                    // Check if we have a Cal.com selected slot (from the slot picker)
                    if (selectedSlotDatetime) {
                        console.log('[submit-contact-form] Creating Cal.com booking for selected slot:', selectedSlotDatetime);

                        // Check Cal.com connection
                        const { data: calConn } = await supabaseAdmin
                            .from('client_cal_calendar')
                            .select('connection_status, refresh_token_present, default_event_type_id')
                            .eq('client_id', targetClientId)
                            .maybeSingle();

                        const calUsable = !!(
                            calConn &&
                            calConn.connection_status === 'connected' &&
                            calConn.refresh_token_present === true &&
                            calConn.default_event_type_id &&
                            String(calConn.default_event_type_id).trim()
                        );

                        if (calUsable) {
                            try {
                                await CalCalendarService.createCalBooking(targetClientId, {
                                    eventTypeId: String(calConn.default_event_type_id),
                                    start: selectedSlotDatetime,
                                    attendee: {
                                        name: fullName,
                                        email: email,
                                        timeZone: 'America/New_York',
                                    },
                                    metadata: {
                                        businessName: businessName || '',
                                        phone: phone || '',
                                        source: 'consultation_form',
                                        projectDescription: projectDescription || '',
                                    },
                                });
                                calendarBookingCreated = true;
                                console.log('[submit-contact-form] Cal.com booking created successfully');
                            } catch (calError: any) {
                                console.error('[submit-contact-form] Cal.com booking failed:', calError.message);
                                // Continue without failing the form submission
                            }
                        } else {
                            console.warn('[submit-contact-form] Cal.com not usable, skipping booking creation');
                        }
                    }
                    // Fallback: Use Google Calendar if no Cal.com slot and preferredDate/Time provided
                    else if (preferredDate && preferredTime) {
                        const dateTimeString = `${preferredDate} ${preferredTime}`;
                        const parsedDate = parse(dateTimeString, 'yyyy-MM-dd h:mm a', new Date());

                        if (!isNaN(parsedDate.getTime())) {
                            const startTimeISO = formatISO(parsedDate);
                            const endTimeISO = formatISO(addMinutes(parsedDate, 30));

                            const eventDetails = {
                                title: `NEW CONSULTATION: ${businessName || fullName}`,
                                startTime: startTimeISO,
                                endTime: endTimeISO,
                                description: detailsText,
                                attendeeEmail: email,
                            };

                            await GoogleCalendarService.createCalendarEvent(targetClientId, eventDetails);
                            calendarBookingCreated = true;
                        } else {
                            console.error('[submit-contact-form] Calendar: Invalid date/time format.');
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error('[submit-contact-form] Calendar Integration Failed:', e.message || e);
        }
    }

    const calendarStatusBadge = calendarBookingCreated
      ? `<p style="background: #10b981; color: white; padding: 8px 12px; border-radius: 6px; display: inline-block; margin-bottom: 16px;">Calendar Booking Confirmed</p>`
      : (formType === 'Consultation Request' ? `<p style="background: #f59e0b; color: white; padding: 8px 12px; border-radius: 6px; display: inline-block; margin-bottom: 16px;">Manual Calendar Confirmation Needed</p>` : '');

    const internalHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0EA5E9;">New ${formType} Submission</h2>
          ${calendarStatusBadge}
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong style="color: #374151;">Name:</strong> ${fullName}</p>
            <p><strong style="color: #374151;">Email:</strong> <a href="mailto:${email}" style="color: #0EA5E9;">${email}</a></p>
            <p><strong style="color: #374151;">Phone:</strong> ${phone || 'Not provided'}</p>
            ${businessName ? `<p><strong style="color: #374151;">Business:</strong> ${businessName}</p>` : ''}
            ${websiteUrl ? `<p><strong style="color: #374151;">Website:</strong> ${websiteUrl}</p>` : ''}
            ${industry ? `<p><strong style="color: #374151;">Industry:</strong> ${industry}</p>` : ''}
            ${Array.isArray(services) && services.length ? `<p><strong style="color: #374151;">Services:</strong> ${services.join(', ')}</p>` : ''}
            ${budget ? `<p><strong style="color: #374151;">Budget:</strong> ${budget}</p>` : ''}
            ${timeline ? `<p><strong style="color: #374151;">Timeline:</strong> ${timeline}</p>` : ''}
            ${referralSource ? `<p><strong style="color: #374151;">Referral Source:</strong> ${referralSource}</p>` : ''}
            ${decisionMaker ? `<p><strong style="color: #374151;">Decision Maker:</strong> ${decisionMaker}</p>` : ''}
            ${preferredDate && preferredTime ? `<p><strong style="color: #374151;">Scheduled Time:</strong> ${preferredDate} at ${preferredTime} ET ${calendarBookingCreated ? '(Confirmed)' : ''}</p>` : ''}
            ${alternateDate && alternateTime ? `<p><strong style="color: #374151;">Alternate Time:</strong> ${alternateDate} at ${alternateTime} ET</p>` : ''}
          </div>
          <div style="background: white; padding: 20px; border-left: 4px solid #0EA5E9; margin: 20px 0;">
            <p><strong style="color: #374151;">Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
            ${projectDescription && projectDescription !== message ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" /><p><strong style="color:#374151">Project Description:</strong></p><p style="white-space: pre-wrap;">${projectDescription}</p>` : ''}
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This message was sent via the contact form on customwebsitesplus.com<br>
            Reply directly to this email to respond to ${fullName}
          </p>
        </div>
    `;

    // 1) Email Support (internal notification)
    await sendPublicFormEmail(
        SUPPORT_EMAIL,
        subject,
        internalHtml,
        email
    );

    // 2) Email the submitter (confirmation)
    const isConsultation = formType === 'Consultation Request';
    const clientSubject = isConsultation && calendarBookingCreated
      ? 'Your consultation is confirmed — Custom Websites Plus'
      : isConsultation
        ? 'We received your consultation request — Custom Websites Plus'
        : 'We received your message — Custom Websites Plus';

    const confirmedBadge = calendarBookingCreated
      ? `<div style="background: #10b981; color: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
           <strong>Your consultation is confirmed!</strong>
         </div>`
      : '';

    const whenLine = preferredDate && preferredTime
      ? `<p style="margin: 0;"><strong>${calendarBookingCreated ? 'Confirmed time:' : 'Preferred time:'}</strong> ${preferredDate} at ${preferredTime} ET</p>`
      : '';

    const altWhenLine = alternateDate && alternateTime && !calendarBookingCreated
      ? `<p style="margin: 0;"><strong>Alternate time:</strong> ${alternateDate} at ${alternateTime} ET</p>`
      : '';

    const nextStepsContent = calendarBookingCreated
      ? `<p style="margin:0;">What happens next:</p>
         <ul style="margin: 8px 0 0 18px; padding: 0;">
           <li>You should receive a calendar invite shortly.</li>
           <li>We will call you at the scheduled time.</li>
           <li>If you need to reschedule, reply to this email.</li>
         </ul>`
      : `<p style="margin:0;">Next steps:</p>
         <ul style="margin: 8px 0 0 18px; padding: 0;">
           <li>We will review your details.</li>
           <li>${isConsultation ? 'We will confirm your consultation time.' : 'We will reply as soon as possible (usually within 24 hours).'}</li>
           <li>If needed, we will follow up for any missing info.</li>
         </ul>`;

    const clientHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0EA5E9; margin-bottom: 8px;">Thanks, ${fullName}!</h2>
        ${confirmedBadge}
        <p style="color:#334155; margin-top: 0;">${calendarBookingCreated ? 'Your consultation has been scheduled. Here are the details:' : 'This is a confirmation email with the details you submitted.'}</p>

        <div style="background:#f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 10px;">
          ${businessName ? `<p style="margin: 0 0 8px 0;"><strong>Business:</strong> ${businessName}</p>` : ''}
          ${whenLine}
          ${altWhenLine}
          <p style="margin: 8px 0 0 0;"><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          ${websiteUrl ? `<p style="margin: 8px 0 0 0;"><strong>Website:</strong> ${websiteUrl}</p>` : ''}
        </div>

        <div style="margin-top: 16px; background: white; padding: 16px; border-left: 4px solid #0EA5E9;">
          <p style="margin: 0 0 6px 0;"><strong>Your message:</strong></p>
          <p style="margin: 0; white-space: pre-wrap; color:#334155;">${message}</p>
          ${projectDescription && projectDescription !== message ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" /><p style="margin:0 0 6px 0;"><strong>Project description:</strong></p><p style="margin:0; white-space: pre-wrap; color:#334155;">${projectDescription}</p>` : ''}
        </div>

        <div style="margin-top: 18px; color:#64748b; font-size: 14px;">
          ${nextStepsContent}
          <p style="margin-top: 12px;">If you need to add details or reschedule, just reply to this email.</p>
        </div>
      </div>
    `;

    await sendPublicFormEmail(
      email,
      clientSubject,
      clientHtml,
      SUPPORT_EMAIL
    );

    return new Response(
      JSON.stringify({ success: true, message: 'Emails sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[submit-contact-form] ERROR:', err.message)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message || 'Unknown error during email submission.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})