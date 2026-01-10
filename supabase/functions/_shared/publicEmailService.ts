import nodemailer from 'https://esm.sh/nodemailer@6.9.14?target=deno';
import { decrypt } from './encryption.ts';

// --- Environment Variables ---
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = "Custom Websites Plus <onboarding@resend.dev>"; // Hardcoded as requested

// SMTP Fallback Config
const SMTP_HOST = Deno.env.get('SMTP_HOST');
const SMTP_PORT = Deno.env.get('SMTP_PORT');
const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASS_RAW = Deno.env.get('SMTP_PASS');
const SMTP_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Custom Websites Plus';
const SMTP_FROM_EMAIL_FALLBACK = Deno.env.get('SMTP_FROM_EMAIL') || SMTP_USER;

// Decrypt the password once for the SMTP fallback path
let SMTP_PASS = SMTP_PASS_RAW || '';
if (SMTP_PASS_RAW) {
  try {
    const decrypted = decrypt(SMTP_PASS_RAW);
    if (decrypted && decrypted.length > 0) {
      SMTP_PASS = decrypted;
    }
  } catch (e) {
    console.log('[publicEmailService] Decryption failed for SMTP password.');
  }
}

export async function sendPublicFormEmail(
    toEmail: string,
    subject: string,
    htmlContent: string,
    replyToEmail: string
) {
    // 1. --- RESEND PRIMARY METHOD ---
    if (RESEND_API_KEY) {
        try {
            console.log('[publicEmailService] Attempting to send email via Resend API.');
            
            const resendResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: RESEND_FROM_EMAIL,
                    to: toEmail,
                    reply_to: replyToEmail,
                    subject: subject,
                    html: htmlContent,
                }),
            });

            const resendData = await resendResponse.json();

            if (resendResponse.ok) {
                console.log(`[publicEmailService] Resend success. ID: ${resendData.id}`);
                return { success: true, messageId: resendData.id };
            } else {
                console.error(`[publicEmailService] Resend API failed (${resendResponse.status}):`, resendData);
                // Fall through to SMTP fallback
            }
        } catch (error) {
            console.error('[publicEmailService] Resend network error, falling back to SMTP:', error);
            // Fall through to SMTP fallback
        }
    } else {
        console.warn('[publicEmailService] RESEND_API_KEY missing. Falling back to SMTP.');
    }

    // 2. --- SMTP FALLBACK METHOD ---
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.error("[publicEmailService] SMTP credentials incomplete. Cannot fallback.");
        throw new Error("Email service failed: Both Resend and SMTP configurations are incomplete or failed.");
    }

    const port = parseInt(SMTP_PORT);
    const isSecurePort = port === 465;

    console.log(`[publicEmailService] Attempting SMTP fallback via ${SMTP_HOST}:${port}. Secure: ${isSecurePort}`);
    
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: port,
        secure: isSecurePort,
        ignoreTLS: isSecurePort, 
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    const mailOptions = {
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL_FALLBACK}>`,
        to: toEmail,
        replyTo: replyToEmail,
        subject: subject,
        html: htmlContent,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[publicEmailService] SMTP fallback success. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error("[publicEmailService] SMTP fallback error:", error.message);
        throw new Error(`SMTP connection failed: ${error.message}`);
    }
}