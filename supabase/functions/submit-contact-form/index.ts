export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { sendPublicFormEmail } from '../_shared/publicEmailService.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { GoogleCalendarService } from '../_shared/googleCalendarService.ts'; // Import the new service
import { parse, formatISO, addMinutes } from 'https://esm.sh/date-fns@3.6.0'; // Import date-fns

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
    
    // --- Google Calendar Event Creation ---
    if (formType === 'Consultation Request' && preferredDate && preferredTime) {
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
                    } else {
                        console.error('[submit-contact-form] Calendar: Invalid date/time format.');
                    }
                }
            }
        } catch (e) {
            console.error('[submit-contact-form] Calendar Integration Failed:', e);
        }
    }

    const internalHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0EA5E9;">New ${formType} Submission</h2>
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
            ${preferredDate && preferredTime ? `<p><strong style="color: #374151;">Preferred Time:</strong> ${preferredDate} at ${preferredTime} ET</p>` : ''}
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
    const clientSubject = isConsultation
      ? 'We received your consultation request — Custom Websites Plus'
      : 'We received your message — Custom Websites Plus';

    const whenLine = preferredDate && preferredTime
      ? `<p style="margin: 0;"><strong>Preferred time:</strong> ${preferredDate} at ${preferredTime} ET</p>`
      : '';

    const altWhenLine = alternateDate && alternateTime
      ? `<p style="margin: 0;"><strong>Alternate time:</strong> ${alternateDate} at ${alternateTime} ET</p>`
      : '';

    const clientHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0EA5E9; margin-bottom: 8px;">Thanks, ${fullName} — we received your ${isConsultation ? 'consultation request' : 'message'}.</h2>
        <p style="color:#334155; margin-top: 0;">This is a confirmation email with the details you submitted.</p>

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
          <p style="margin:0;">Next steps:</p>
          <ul style="margin: 8px 0 0 18px; padding: 0;">
            <li>We will review your details.</li>
            <li>${isConsultation ? 'We will confirm your consultation time.' : 'We will reply as soon as possible (usually within 24 hours).'}</li>
            <li>If needed, we will follow up for any missing info.</li>
          </ul>
          <p style="margin-top: 12px;">If you need to add details, just reply to this email.</p>
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