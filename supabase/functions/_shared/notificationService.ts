import { sendPublicFormEmail } from './publicEmailService.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Billing stage notifications
//   Stage 1 – Invoice overdue notice
//   Stage 2 – Final notice before service restriction
//   Stage 3 – Payment confirmed / access restored
// ─────────────────────────────────────────────────────────────────────────────
export async function sendBillingNotification(
  clientEmail: string,
  clientName: string,
  stage: 1 | 2 | 3,
  graceDate?: string
) {
  let subject = '';
  let html = '';

  switch (stage) {
    case 1:
      subject = `Action Required – Invoice Past Due for ${clientName}`;
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#d97706;">Invoice Past Due</h2>
          <p>Dear ${clientName},</p>
          <p>Your recent invoice is now <strong>overdue</strong>. Please log in to your client portal and pay by <strong>${graceDate || 'as soon as possible'}</strong> to avoid service interruption.</p>
          <p><a href="https://customwebsitesplus.com/client/billing" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">View Invoice &amp; Pay</a></p>
          <p style="color:#64748b;font-size:13px;">If you have already paid, please disregard this notice.</p>
          <p>Thank you,<br/>The Custom Websites Plus Team</p>
        </div>`;
      break;
    case 2:
      subject = `Final Notice – Service Access At Risk for ${clientName}`;
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#dc2626;">Final Notice — Service Access At Risk</h2>
          <p>Dear ${clientName},</p>
          <p>This is your <strong>final reminder</strong>. Access to your project portal will be restricted after <strong>${graceDate || 'the due date'}</strong> if the outstanding invoice remains unpaid.</p>
          <p><a href="https://customwebsitesplus.com/client/billing" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Pay Now to Keep Access</a></p>
          <p style="color:#64748b;font-size:13px;">Contact us immediately if you have questions or need assistance.</p>
          <p>Thank you,<br/>The Custom Websites Plus Team</p>
        </div>`;
      break;
    case 3:
      subject = `Payment Confirmed – Access Restored for ${clientName}`;
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#16a34a;">Payment Confirmed</h2>
          <p>Dear ${clientName},</p>
          <p>Your payment has been <strong>successfully processed</strong>. Full access to your project portal has been restored.</p>
          <p><a href="https://customwebsitesplus.com/client/billing" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Go to My Portal</a></p>
          <p>Thank you for your continued business!</p>
          <p>The Custom Websites Plus Team</p>
        </div>`;
      break;
    default:
      console.warn(`[notificationService] Unknown billing notification stage: ${stage}`);
      return;
  }

  console.log(`[notificationService] Sending billing notification (stage ${stage}) to ${clientEmail}`);
  try {
    await sendPublicFormEmail(clientEmail, subject, html, 'billing@customwebsitesplus.com');
  } catch (e: any) {
    console.error(`[notificationService] Failed to send billing notification: ${e.message}`);
  }

  return { success: true, subject };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service status notifications (paused / resumed)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendServiceStatusNotification(
    clientEmail: string,
    clientName: string,
    action: 'paused' | 'resumed',
    projectTitle?: string
) {
    const target = projectTitle ? `on project: <strong>${projectTitle}</strong>` : 'on your account';
    let subject = '';
    let html = '';

    if (action === 'paused') {
        subject = `Important: Service Temporarily Paused for ${clientName}`;
        html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#d97706;">Service Temporarily Paused</h2>
            <p>Dear ${clientName},</p>
            <p>Active work ${target} has been temporarily paused by our team. Your client portal remains fully accessible and you can view all project details, files, and billing history.</p>
            <p>No action is required unless noted by your project manager. Please contact us if you have any questions.</p>
            <p>Thank you,<br/>The Custom Websites Plus Team</p>
          </div>`;
    } else if (action === 'resumed') {
        subject = `Update: Service Resumed for ${clientName}`;
        html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#16a34a;">Service Resumed</h2>
            <p>Dear ${clientName},</p>
            <p>Active work ${target} has now <strong>resumed</strong>. We appreciate your patience and look forward to continuing your project.</p>
            <p>You can track the latest progress in your <a href="https://customwebsitesplus.com/client/projects">client portal</a>.</p>
            <p>Thank you,<br/>The Custom Websites Plus Team</p>
          </div>`;
    } else {
        return { success: false, message: 'Invalid action' };
    }

    console.log(`[notificationService] Sending service status email (${action}) to ${clientEmail}`);
    try {
        await sendPublicFormEmail(clientEmail, subject, html, 'support@customwebsitesplus.com');
    } catch (e: any) {
        console.error(`[notificationService] Failed to send service status notification: ${e.message}`);
    }

    return { success: true, subject };
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice reminder (upcoming / overdue)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendInvoiceReminder(
    supabaseAdmin: any,
    invoiceId: string,
    clientEmail: string,
    clientName: string,
    invoiceAmount: number,
    hostedUrl: string,
    reminderType: 'upcoming' | 'overdue'
) {
    const isOverdue = reminderType === 'overdue';
    const subject = isOverdue
        ? `URGENT: Invoice for $${invoiceAmount.toFixed(2)} is Past Due — ${clientName}`
        : `Reminder: Your Invoice for $${invoiceAmount.toFixed(2)} is Due Soon — ${clientName}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:${isOverdue ? '#dc2626' : '#d97706'};">${isOverdue ? 'Invoice Past Due' : 'Invoice Due Soon'}</h2>
        <p>Dear ${clientName},</p>
        <p>This is a ${isOverdue ? '<strong>urgent reminder</strong>' : 'friendly reminder'} regarding your invoice for <strong>$${invoiceAmount.toFixed(2)}</strong>.</p>
        <p>Status: <strong>${isOverdue ? 'Past Due' : 'Due Soon'}</strong></p>
        <p>
          <a href="${hostedUrl}" style="display:inline-block;background:${isOverdue ? '#dc2626' : '#4f46e5'};color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">
            View &amp; Pay Invoice
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">If you have already made this payment, please disregard this email. Contact us if you have any questions.</p>
        <p>Thank you,<br/>The Custom Websites Plus Team</p>
      </div>`;

    console.log(`[notificationService] Sending ${reminderType} reminder for invoice ${invoiceId} to ${clientEmail}`);

    try {
        await sendPublicFormEmail(clientEmail, subject, html, 'billing@customwebsitesplus.com');
    } catch (e: any) {
        console.error(`[notificationService] Failed to send invoice reminder: ${e.message}`);
    }

    // Update the invoice record to record that a reminder was sent
    await supabaseAdmin
        .from('invoices')
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq('id', invoiceId);

    return { success: true, subject };
}

// ─────────────────────────────────────────────────────────────────────────────
// New subscription created — client needs to pay the first invoice
// ─────────────────────────────────────────────────────────────────────────────
export async function sendSubscriptionCreatedNotification(
    clientEmail: string,
    clientName: string,
    planName: string,
    hostedInvoiceUrl: string
) {
    const subject = `Action Required: Complete Your ${planName} Subscription Setup`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#4f46e5;">Your Subscription is Ready — Payment Required</h2>
        <p>Dear ${clientName},</p>
        <p>Your <strong>${planName}</strong> subscription has been set up and is ready to activate. To complete the setup and start your subscription, please pay the first invoice now.</p>
        <p>
          <a href="${hostedInvoiceUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Pay First Invoice &amp; Activate Subscription
          </a>
        </p>
        <p>After payment, your subscription will be automatically activated and billed monthly. You can manage your subscription anytime from your <a href="https://customwebsitesplus.com/client/billing">billing portal</a>.</p>
        <p style="color:#64748b;font-size:13px;">If you have any questions, reply to this email or contact us at support@customwebsitesplus.com.</p>
        <p>Thank you,<br/>The Custom Websites Plus Team</p>
      </div>`;

    console.log(`[notificationService] Sending subscription created notification to ${clientEmail} for plan: ${planName}`);
    try {
        await sendPublicFormEmail(clientEmail, subject, html, 'billing@customwebsitesplus.com');
    } catch (e: any) {
        console.error(`[notificationService] Failed to send subscription created notification: ${e.message}`);
    }

    return { success: true, subject };
}
