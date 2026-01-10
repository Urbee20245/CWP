import { decrypt } from './encryption.ts'; // Keep import for now, though not used here

// --- Environment Variables ---
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || 'noreply@customwebsitesplus.com';
const RESEND_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Custom Websites Plus';

export async function sendPublicFormEmail(
    toEmail: string,
    subject: string,
    htmlContent: string,
    replyToEmail: string
) {
    if (!RESEND_API_KEY) {
        console.error('[publicEmailService] CRITICAL: RESEND_API_KEY missing. Cannot send email.');
        throw new Error("Email service failed: RESEND_API_KEY is not configured.");
    }
    
    try {
        console.log('[publicEmailService] Attempting to send email via Resend API.');
        
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `"${RESEND_FROM_NAME}" <${RESEND_FROM_EMAIL}>`,
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
            const errorMsg = resendData.message || `Resend API failed with status ${resendResponse.status}`;
            console.error(`[publicEmailService] Resend API failed:`, errorMsg);
            throw new Error(`Resend API failed: ${errorMsg}`);
        }
    } catch (error: any) {
        console.error('[publicEmailService] Resend network error:', error.message);
        throw new Error(`Email service failed: ${error.message}`);
    }
}