import nodemailer from 'https://esm.sh/nodemailer@6.9.14?target=deno';

// Environment variables are read directly by Deno runtime
const SMTP_HOST = Deno.env.get('SMTP_HOST');
const SMTP_PORT = Deno.env.get('SMTP_PORT');
const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASS = Deno.env.get('SMTP_PASS');
const SMTP_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Custom Websites Plus';
const SMTP_FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || SMTP_USER; // Use dedicated FROM email if set, otherwise use SMTP_USER

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

    const port = parseInt(SMTP_PORT);
    const isSecurePort = port === 465;

    console.log(`[publicEmailService] Attempting to send email via ${SMTP_HOST}:${port}. Secure: ${isSecurePort}`);

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: port,
        secure: isSecurePort, // Use implicit SSL for port 465
        // Adding ignoreTLS as a diagnostic step for socket close errors
        // If this works, the server might be misconfigured or Deno's TLS stack is having issues.
        // We will remove this if it doesn't help.
        ignoreTLS: isSecurePort, 
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    const mailOptions = {
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`, // Use SMTP_FROM_EMAIL for sender
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