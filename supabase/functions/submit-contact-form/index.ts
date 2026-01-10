import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== CONTACT FORM FUNCTION START ===')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Received data:', {
      hasFullName: !!body.fullName,
      hasEmail: !!body.email,
      hasMessage: !!body.message,
      formType: body.formType
    })

    const { fullName, email, phone, message, formType = 'Contact Form' } = body

    // Validate required fields
    if (!fullName || !email || !message) {
      console.error('VALIDATION ERROR: Missing required fields')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get SMTP configuration from environment
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = Deno.env.get('SMTP_PORT')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    
    console.log('SMTP Configuration:', {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      hasPassword: !!smtpPass
    })
    
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('SMTP CREDENTIALS MISSING!')
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creating SMTP client for port 465 (SSL)...')
    
    // Port 465 requires different TLS configuration
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort || '465'),
        tls: true,  // SSL/TLS enabled for port 465
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    })

    console.log('Sending email...')
    
    await client.send({
      from: `Custom Websites Plus <${smtpUser}>`,  // Use your actual email as sender
      to: smtpUser,  // Send to yourself
      replyTo: email,  // So you can reply to the customer
      subject: `New ${formType}: ${fullName}`,
      content: `
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
      `,
      html: true,
    })

    console.log('Closing SMTP connection...')
    await client.close()
    
    console.log('✅ EMAIL SENT SUCCESSFULLY!')

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ ERROR IN CONTACT FORM FUNCTION:')
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to send email: ' + error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})