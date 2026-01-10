import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🔷 Step 1: Function called')

  try {
    console.log('🔷 Step 2: Parsing request body')
    const body = await req.json()
    
    console.log('🔷 Step 3: Body parsed:', JSON.stringify(body))
    
    const { fullName, email, phone, message, formType = 'Contact Form' } = body

    console.log('🔷 Step 4: Extracted fields:', { 
      fullName, 
      email, 
      phone: phone || 'none',
      messageLength: message?.length || 0,
      formType 
    })

    if (!fullName || !email || !message) {
      console.log('❌ Missing fields:', { 
        noFullName: !fullName, 
        noEmail: !email, 
        noMessage: !message 
      })
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔷 Step 5: Getting SMTP credentials from environment')
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = Deno.env.get('SMTP_PORT')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')

    console.log('🔷 Step 6: SMTP credentials check:', {
      hasHost: !!smtpHost,
      host: smtpHost || 'MISSING',
      hasPort: !!smtpPort,
      port: smtpPort || 'MISSING',
      hasUser: !!smtpUser,
      user: smtpUser || 'MISSING',
      hasPass: !!smtpPass,
      passLength: smtpPass?.length || 0
    })

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log('❌ SMTP credentials incomplete')
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔷 Step 7: Importing SMTPClient')
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts")
    
    console.log('🔷 Step 8: Creating SMTP client with config:', {
      hostname: smtpHost,
      port: parseInt(smtpPort || '465'),
      tls: true,
      username: smtpUser
    })

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort || '465'),
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    })

    console.log('🔷 Step 9: Preparing email data')
    const emailContent = {
      from: `Custom Websites Plus <${smtpUser}>`,
      to: smtpUser,
      replyTo: email,
      subject: `New ${formType}: ${fullName}`,
      content: `
        <h2>New ${formType}</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
      html: true,
    }

    console.log('🔷 Step 10: Sending email...')
    await client.send(emailContent)
    
    console.log('🔷 Step 11: Closing connection...')
    await client.close()
    
    console.log('✅ SUCCESS: Email sent!')

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.log('❌❌❌ CAUGHT ERROR ❌❌❌')
    console.log('Error object:', err)
    console.log('Error type:', typeof err)
    console.log('Error constructor:', err?.constructor?.name)
    console.log('Error message:', err?.message)
    console.log('Error toString:', String(err))
    
    if (err && typeof err === 'object') {
      console.log('Error keys:', Object.keys(err))
      for (const key of Object.keys(err)) {
        console.log(`  ${key}:`, err[key])
      }
    }
    
    if (err?.stack) {
      console.log('Error stack:', err.stack)
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(err?.message || err || 'Unknown error')
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})