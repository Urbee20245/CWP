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

    // --- 1. Check for active Resend configuration ---
    const { data: resendSettings } = await supabaseAdmin
      .from('resend_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();
      
    if (resendSettings) {
        console.log('[send-email] Using Resend API.');
        
        // Decrypt API Key
        const decryptedApiKey = decrypt(resendSettings.api_key_encrypted);
        if (!decryptedApiKey || decryptedApiKey.length === 0) {
            logEntry.error_message = 'Failed to decrypt Resend API key. Falling back to SMTP.';
            console.error(logEntry.error_message);
            // Fall through to SMTP logic
        } else {
            // Attempt to send via Resend API
            const resendResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${decryptedApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: `"${resendSettings.from_name}" <${resendSettings.from_email}>`,
                    to: to_email,
                    subject: subject,
                    html: html_body,
                    text: text_body || html_body.replace(/<[^>]*>?/gm, ''),
                }),
            });

            const resendData = await resendResponse.json();

            if (resendResponse.ok) {
                console.log(`[send-email] Resend success. ID: ${resendData.id}`);
                logEntry.status = 'sent';
                await supabaseAdmin.from('email_logs').insert(logEntry);
                return jsonResponse({ success: true, messageId: resendData.id });
            } else {
                const errorMsg = resendData.message || `Resend API failed (${resendResponse.status})`;
                logEntry.error_message = errorMsg;
                console.error(`[send-email] Resend failed, falling back to SMTP: ${errorMsg}`);
                // Fall through to SMTP logic
            }
        }
    }

    // --- 2. Fallback to SMTP configuration ---
    console.log('[send-email] Using SMTP fallback.');
    
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

    // Decrypt password
    const decryptedPassword = decrypt(smtpSettings.password_encrypted);
    if (!decryptedPassword || decryptedPassword.length === 0) {
        logEntry.error_message = 'Failed to decrypt SMTP password. Check SMTP_ENCRYPTION_KEY secret.';
        await supabaseAdmin.from('email_logs').insert(logEntry);
        return errorResponse('Email sending failed: Failed to decrypt SMTP password. Check SMTP_ENCRYPTION_KEY secret.', 500);
    }

    // Configure Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: {
        user: smtpSettings.username,
        pass: decryptedPassword,
      },
    });

    // Send Email
    const mailOptions = {
      from: `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`,
      to: to_email,
      subject: subject,
      html: html_body,
      text: text_body || html_body.replace(/<[^>]*>?/gm, ''),
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[send-email] SMTP success. Message sent: ${info.messageId}`);
    
    // Log Success
    logEntry.status = 'sent';
    await supabaseAdmin.from('email_logs').insert(logEntry);

    return jsonResponse({ success: true, messageId: info.messageId });

  } catch (error: any) {
    console.error('[send-email] Unhandled error:', error.message);
    
    // Log Failure
    const errorMessage = error.response || error.message || 'Unknown SMTP error.';
    logEntry.error_message = errorMessage;
    await supabaseAdmin.from('email_logs').insert(logEntry);
    
    // Return the specific error message
    return errorResponse(`Email sending failed: ${errorMessage}`, 500);
  }
});