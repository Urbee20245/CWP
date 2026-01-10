import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== CONTACT FORM FUNCTION CALLED ===')
  
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
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: fullName, email, and message' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get SMTP config
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    
    console.log('SMTP Configuration:', {
      host: smtpHost?.substring(0, 10) + '...',
      port: smtpPort,
      hasUser: !!smtpUser,
      hasPass: !!smtpPass
    })
    
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('SMTP CREDENTIALS MISSING')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service not configured' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creating SMTP client...')
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    })

    console.log('Sending email...')
    await client.send({
      from: "Custom Websites Plus <hello@customwebsitesplus.com>",
      to: "hello@customwebsitesplus.com",
      replyTo: email,
      subject: `New ${formType}: ${fullName}`,
      content: `
        <h2>New ${formType} Submission</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
      html: true,
    })

    await client.close()
    console.log('✅ EMAIL SENT SUCCESSFULLY')

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ FATAL ERROR:', error)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send email'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})