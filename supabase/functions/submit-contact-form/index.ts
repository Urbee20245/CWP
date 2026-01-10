import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { fullName, email, phone, message, recaptchaToken, formType } = await req.json();

    // Validate input
    if (!fullName || !email || !message || !recaptchaToken) {
      return errorResponse('Missing required fields (name, email, message, or security token).', 400);
    }

    // Get environment variables
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const toEmail = Deno.env.get('SMTP_FROM_EMAIL') || 'hello@customwebsitesplus.com';
    const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Custom Websites Plus';

    // Check if SMTP is configured
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('[submit-contact-form] SMTP not configured. Missing environment variables.');
      return errorResponse('Email service not configured. Contact administrator.', 500);
    }

    // Create SMTP client
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
    });

    // Construct email content
    const subject = `New ${formType || 'Contact'} Request: ${fullName} (${email})`;
    const htmlContent = `
      <h2>New ${formType || 'Contact'} Submission</h2>
      <p><strong>Form Type:</strong> ${formType || 'Quick Inquiry'}</p>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap; border: 1px solid #eee; padding: 10px; background-color: #f9f9f9;">${message}</p>
      <hr>
      <p style="font-size: 10px; color: #999;">Recaptcha Token: ${recaptchaToken}</p>
    `;

    // Send email
    await client.send({
      from: `${fromName} <${toEmail}>`,
      to: 'hello@customwebsitesplus.com', // Send to hardcoded recipient
      subject: subject,
      content: htmlContent,
      html: true,
    });

    await client.close();

    return jsonResponse({ success: true, message: 'Email sent successfully' });

  } catch (error: any) {
    console.error('[submit-contact-form] Error:', error.message);
    return errorResponse(`Failed to send email: ${error.message}`, 500);
  }
});