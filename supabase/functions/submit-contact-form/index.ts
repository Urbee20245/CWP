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
    
    const { fullName, email, phone, message, formType = 'Contact Form', preferredDate, preferredTime, businessName } = body

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
    const emailBody = `Phone: ${phone || 'Not provided'}\n\nMessage:\n${message}`;

    // --- NEW: Store incoming message in the database ---
    const { error: dbError } = await supabaseAdmin
      .from('incoming_emails')
      .insert({
        from_name: fullName,
        from_email: email,
        subject: subject,
        body: emailBody,
        status: 'unread'
      });

    if (dbError) {
      console.error('❌ ERROR saving incoming email to DB:', dbError.message);
      // Log the error but continue to send the email notification.
    } else {
      console.log('✅ Incoming email saved to database.');
    }
    
    // --- NEW: Google Calendar Event Creation (Part 6) ---
    if (formType === 'Consultation Request' && preferredDate && preferredTime) {
        try {
            // 1. Find the Admin Profile ID (assuming the admin is the one receiving the notification)
            // For simplicity, we assume the admin receiving the notification is the target calendar owner.
            // In a real scenario, this would be linked to the specific admin who owns the calendar connection.
            // Since we don't have a direct link here, we'll use a placeholder client ID for now.
            
            // For this implementation, we assume the client ID is the target for the calendar connection.
            // We need to find the client ID associated with the admin's profile (which is complex here).
            // Instead, we will assume the calendar connection is linked to the primary admin user's client ID (if one exists) or skip.
            
            // Since this form is public, we cannot reliably get the target client_id.
            // We will use a placeholder logic: find the first admin profile and use their client ID.
            
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
                    
                    // 2. Parse Date/Time (Assuming ET timezone for booking form)
                    const dateTimeString = `${preferredDate} ${preferredTime}`;
                    const parsedDate = parse(dateTimeString, 'yyyy-MM-dd h:mm a', new Date());
                    
                    // Ensure the date is valid
                    if (isNaN(parsedDate.getTime())) {
                        console.error('❌ Calendar: Invalid date/time format.');
                    } else {
                        const startTimeISO = formatISO(parsedDate);
                        const endTimeISO = formatISO(addMinutes(parsedDate, 30)); // Assuming 30 min consultation
                        
                        const eventDetails = {
                            title: `NEW CONSULTATION: ${businessName || fullName}`,
                            startTime: startTimeISO,
                            endTime: endTimeISO,
                            description: `Client: ${fullName}\nEmail: ${email}\nPhone: ${phone}\n\nProject Description:\n${message}`,
                            attendeeEmail: email,
                        };
                        
                        await GoogleCalendarService.createCalendarEvent(targetClientId, eventDetails);
                        console.log('✅ Google Calendar event created successfully.');
                    }
                }
            }
        } catch (e) {
            console.error('❌ Calendar Integration Failed:', e);
            // Do not throw, allow form submission to succeed
        }
    }
    // --- END Google Calendar Event Creation ---

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0EA5E9;">New ${formType} Submission</h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong style="color: #374151;">Name:</strong> ${fullName}</p>
            <p><strong style="color: #374151;">Email:</strong> <a href="mailto:${email}" style="color: #0EA5E9;">${email}</a></p>
            <p><strong style="color: #374151;">Phone:</strong> ${phone || 'Not provided'}</p>
            ${businessName ? `<p><strong style="color: #374151;">Business:</strong> ${businessName}</p>` : ''}
            ${preferredDate && preferredTime ? `<p><strong style="color: #374151;">Requested Time:</strong> ${preferredDate} at ${preferredTime} ET</p>` : ''}
          </div>
          <div style="background: white; padding: 20px; border-left: 4px solid #0EA5E9; margin: 20px 0;">
            <p><strong style="color: #374151;">Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This message was sent via the contact form on customwebsitesplus.com<br>
            Reply directly to this email to respond to ${fullName}
          </p>
        </div>
    `;
    
    // The service will read SMTP_USER from environment variables and send the email to itself
    await sendPublicFormEmail(
        Deno.env.get('SMTP_USER')!, // Send to the configured SMTP user
        subject,
        htmlContent,
        email // Set reply-to to the user's email
    );

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('❌ ERROR IN CONTACT FORM FUNCTION:', err.message)
    
    // Return the specific error message from the service for better debugging
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message || 'Unknown error during email submission.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})