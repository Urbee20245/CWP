import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || 'noreply@customwebsitesplus.com';
const RESEND_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Custom Websites Plus';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://portal.customwebsitesplus.com';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!RESEND_API_KEY) {
    return errorResponse('Email service not configured: RESEND_API_KEY missing.', 500);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { proposalId, clientEmail, clientName, proposalTitle, adminMessage } = await req.json();

    if (!proposalId || !clientEmail) {
      return errorResponse('Missing required fields: proposalId, clientEmail.', 400);
    }

    console.log(`[send-proposal-email] Sending proposal ${proposalId} to ${clientEmail}`);

    const proposalUrl = `${SITE_URL}/client/proposals/${proposalId}`;
    const title = proposalTitle || 'Your Service Proposal';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F4F6FA;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Custom Websites Plus</h1>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Your service proposal is ready</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1E293B;">Hi ${clientName || 'there'},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                We've prepared a service proposal for you. Please review it and let us know if you'd like to move forward.
              </p>

              ${adminMessage ? `
              <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:20px;margin-bottom:28px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6366F1;text-transform:uppercase;letter-spacing:0.5px;">A note from your team:</p>
                <p style="margin:0;font-size:14px;color:#374151;font-style:italic;line-height:1.6;">${adminMessage}</p>
              </div>
              ` : ''}

              <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1E293B;">${title}</h2>
              <p style="margin:0 0 32px;font-size:14px;color:#64748B;">
                Click the button below to view your full proposal, see pricing details, and respond with your decision.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${proposalUrl}"
                       style="display:inline-block;background:#4F46E5;color:#ffffff;font-size:16px;font-weight:700;
                              text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:-0.2px;">
                      View My Proposal →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;font-size:13px;color:#94A3B8;text-align:center;">
                Or copy this link: <a href="${proposalUrl}" style="color:#4F46E5;">${proposalUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                This email was sent by Custom Websites Plus on behalf of your team.<br />
                If you have questions, reply to this email or log in to your client portal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `"${RESEND_FROM_NAME}" <${RESEND_FROM_EMAIL}>`,
        to: [clientEmail],
        subject: `Your Service Proposal is Ready — ${title}`,
        html: htmlBody,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('[send-proposal-email] Resend API error:', resendError);
      return errorResponse(`Failed to send email: ${resendError}`, 500);
    }

    const resendData = await resendResponse.json();
    console.log(`[send-proposal-email] Email sent successfully, id: ${resendData.id}`);

    // Log the email send in Supabase email_logs if it exists
    try {
      await supabaseAdmin.from('email_logs').insert({
        to_email: clientEmail,
        subject: `Your Service Proposal is Ready — ${title}`,
        body: htmlBody,
        status: 'sent',
      });
    } catch {
      // Non-fatal: logging table may not exist
    }

    return jsonResponse({ success: true, messageId: resendData.id });

  } catch (error: any) {
    console.error('[send-proposal-email] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
