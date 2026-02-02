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
      console.error('❌ ERROR saving incoming email to DB:', dbError.message);
      // Log the error but continue to send the email notification.
    } else {
      console.log('✅ Incoming email saved to database.');
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
                    
                    if (isNaN(parsedDate.getTime())) {
                        console.error('❌ Calendar: Invalid date/time format.');
                    } else {
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
                        console.log('✅ Google Calendar event created successfully.');
                    }
                }
            }
        } catch (e) {
            console.error('❌ Calendar Integration Failed:', e);
        }
    }

    const htmlContent = `
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

    // Send all inquiries to Support (like the "send message" form behavior)
    await sendPublicFormEmail(
        'support@customwebsiteplus.com',
        subject,
        htmlContent,
        email
    );

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('❌ ERROR IN CONTACT FORM FUNCTION:', err.message)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message || 'Unknown error during email submission.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})