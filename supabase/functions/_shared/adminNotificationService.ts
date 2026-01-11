// --- Environment Variables ---
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || 'noreply@customwebsitesplus.com';
const RESEND_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Custom Websites Plus';

// --- Supabase Admin Client (Must be initialized in the calling function) ---

export async function sendAdminNotification(
    supabaseAdmin: any,
    subject: string,
    htmlContent: string
) {
    if (!RESEND_API_KEY) {
        console.error('[adminNotificationService] CRITICAL: RESEND_API_KEY missing. Cannot send admin email.');
        return { success: false, error: "RESEND_API_KEY is not configured." };
    }
    
    try {
        // 1. Fetch all active admin notification emails
        const { data: recipients, error: fetchError } = await supabaseAdmin
            .from('admin_notification_emails')
            .select('email')
            .eq('is_active', true);
            
        if (fetchError) {
            console.error('[adminNotificationService] Failed to fetch recipients:', fetchError);
            return { success: false, error: "Failed to fetch admin recipients." };
        }
        
        const toEmails = recipients.map((r: { email: string }) => r.email);
        
        if (toEmails.length === 0) {
            console.warn('[adminNotificationService] No active admin notification emails found.');
            return { success: true, message: "No recipients found." };
        }

        console.log(`[adminNotificationService] Sending notification to ${toEmails.length} admins.`);
        
        // 2. Send Email via Resend (sending to all recipients in one call)
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `"${RESEND_FROM_NAME}" <${RESEND_FROM_EMAIL}>`,
                to: toEmails,
                subject: `[CWP ALERT] ${subject}`,
                html: htmlContent,
            }),
        });

        const resendData = await resendResponse.json();

        if (resendResponse.ok) {
            console.log(`[adminNotificationService] Resend success. ID: ${resendData.id}`);
            return { success: true, messageId: resendData.id };
        } else {
            const errorMsg = resendData.message || `Resend API failed with status ${resendResponse.status}`;
            console.error(`[adminNotificationService] Resend API failed:`, errorMsg);
            return { success: false, error: `Resend API failed: ${errorMsg}` };
        }
    } catch (error: any) {
        console.error('[adminNotificationService] Network error:', error.message);
        return { success: false, error: `Email service failed: ${error.message}` };
    }
}