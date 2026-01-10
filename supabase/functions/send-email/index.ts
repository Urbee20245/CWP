import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'https://esm.sh/nodemailer@6.9.14?target=deno';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { decrypt } from '../_shared/encryption.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let logEntry = {
    client_id: null as string | null,
    to_email: '',
    subject: '',
    body: '',
    status: 'failed',
    error_message: '',
    sent_by: null as string | null,
  };

  try {
    const { to_email, subject, html_body, text_body, client_id, sent_by } = await req.json();

    if (!to_email || !subject || !html_body) {
      return errorResponse('Missing required email fields.', 400);
    }
    
    logEntry.client_id = client_id;
    logEntry.to_email = to_email;
    logEntry.subject = subject;
    logEntry.body = html_body;
    logEntry.sent_by = sent_by;

    // 1. Fetch active SMTP settings
    const { data: smtpSettings, error: settingsError } = await supabaseAdmin
      .from('smtp_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (settingsError || !smtpSettings) {
      const msg = settingsError ? settingsError.message : 'No active SMTP configuration found.';
      logEntry.error_message = msg;
      await supabaseAdmin.from('email_logs').insert(logEntry);
      return errorResponse(msg, 500);
    }

    // 2. Decrypt password
    const decryptedPassword = decrypt(smtpSettings.password_encrypted);
    if (!decryptedPassword) {
        logEntry.error_message = 'Failed to decrypt SMTP password. Check SMTP_ENCRYPTION_KEY.';
        await supabaseAdmin.from('email_logs').insert(logEntry);
        return errorResponse('Failed to decrypt SMTP password. Check SMTP_ENCRYPTION_KEY.', 500);
    }

    // 3. Configure Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: {
        user: smtpSettings.username,
        pass: decryptedPassword,
      },
    });

    // 4. Send Email
    const mailOptions = {
      from: `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`,
      to: to_email,
      subject: subject,
      html: html_body,
      text: text_body || html_body.replace(/<[^>]*>?/gm, ''), // Basic HTML to text conversion
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[send-email] Message sent: ${info.messageId}`);
    
    // 5. Log Success
    logEntry.status = 'sent';
    await supabaseAdmin.from('email_logs').insert(logEntry);

    return jsonResponse({ success: true, messageId: info.messageId });

  } catch (error: any) {
    console.error('[send-email] Unhandled error:', error.message);
    
    // 5. Log Failure
    // Capture the specific error message from Nodemailer/transport
    const errorMessage = error.response || error.message || 'Unknown SMTP error.';
    logEntry.error_message = errorMessage;
    await supabaseAdmin.from('email_logs').insert(logEntry);
    
    // Return the specific error message
    return errorResponse(`Email sending failed: ${errorMessage}`, 500);
  }
});