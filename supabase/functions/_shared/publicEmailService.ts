import nodemailer from 'https://esm.sh/nodemailer@6.9.14?target=deno';

// Environment variables are read directly by Deno runtime
const SMTP_HOST = Deno.env.get('SMTP_HOST');
const SMTP_PORT = Deno.env.get('SMTP_PORT');
const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASS = Deno.env.get('SMTP_PASS');
const SMTP_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Custom Websites Plus';

export async function sendPublicFormEmail(
    toEmail: string,
    subject: string,
    htmlContent: string,
    replyToEmail: string
) {
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.error("[publicEmailService] SMTP credentials incomplete.");
        throw new Error("Email service not configured (Missing SMTP secrets).");
    }

    console.log(`[publicEmailService] Attempting to send email via ${SMTP_HOST}:${SMTP_PORT}`);

    // Port 465 typically requires secure: true (implicit SSL)
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT),
        secure: parseInt(SMTP_PORT) === 465, // Use implicit SSL for port 465
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    const mailOptions = {
        from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
        to: toEmail,
        replyTo: replyToEmail,
        subject: subject,
        html: htmlContent,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[publicEmailService] Message sent: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error("[publicEmailService] Nodemailer error:", error.message);
        throw new Error(`SMTP connection failed: ${error.message}`);
    }
}