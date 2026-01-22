import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { sendPublicFormEmail } from '../_shared/publicEmailService.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
    
    const { fullName, email, phone, message, formType = 'Contact Form' } = body

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

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0EA5E9;">New ${formType} Submission</h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong style="color: #374151;">Name:</strong> ${fullName}</p>
            <p><strong style="color: #374151;">Email:</strong> <a href="mailto:${email}" style="color: #0EA5E9;">${email}</a></p>
            <p><strong style="color: #374151;">Phone:</strong> ${phone || 'Not provided'}</p>
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