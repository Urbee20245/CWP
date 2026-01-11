import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { marked } from 'https://esm.sh/marked@12.0.2'; // Import marked

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || 'noreply@customwebsitesplus.com';
const RESEND_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Custom Websites Plus';

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

  if (!RESEND_API_KEY) {
    return errorResponse('Email service failed: RESEND_API_KEY is not set in Supabase Secrets.', 500);
  }

  try {
    // Accept either html_body (from AdminService) or markdown_body (from other Edge Functions)
    const { to_email, subject, html_body, markdown_body, client_id, sent_by } = await req.json();

    if (!to_email || !subject || (!html_body && !markdown_body)) {
      return errorResponse('Missing required email fields (to_email, subject, and body).', 400);
    }
    
    // Convert markdown to HTML if markdown_body is provided
    const finalHtmlBody = markdown_body ? marked.parse(markdown_body) : html_body;
    
    logEntry.client_id = client_id;
    logEntry.to_email = to_email;
    logEntry.subject = subject;
    // Log the HTML body for consistency
    logEntry.body = finalHtmlBody; 
    logEntry.sent_by = sent_by;

    // 1. Send Email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `"${RESEND_FROM_NAME}" <${RESEND_FROM_EMAIL}>`,
            to: to_email,
            subject: subject,
            html: finalHtmlBody,
        }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
        const errorMsg = resendData.message || `Resend API failed with status ${resendResponse.status}`;
        throw new Error(errorMsg);
    }
    
    console.log(`[send-email] Message sent via Resend: ${resendData.id}`);
    
    // 2. Log Success
    logEntry.status = 'sent';
    await supabaseAdmin.from('email_logs').insert(logEntry);

    return jsonResponse({ success: true, messageId: resendData.id });

  } catch (error: any) {
    console.error('[send-email] Unhandled error:', error.message);
    
    // 3. Log Failure
    logEntry.error_message = error.message;
    await supabaseAdmin.from('email_logs').insert(logEntry);
    
    return errorResponse(`Email sending failed: ${error.message}`, 500);
  }
});