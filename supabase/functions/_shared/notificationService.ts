// This is a mock service. In a real environment, this would integrate with SendGrid/Postmark/Twilio.

export async function sendBillingNotification(
  clientEmail: string,
  clientName: string,
  stage: 1 | 2 | 3,
  graceDate?: string
) {
  let subject = '';
  let body = '';

  switch (stage) {
    case 1:
      subject = `Action Required – Invoice Past Due for ${clientName}`;
      body = `Dear ${clientName}, your recent invoice is now overdue. Please pay it by ${graceDate} to avoid service interruption.`;
      break;
    case 2:
      subject = `Final Notice – Service Access At Risk for ${clientName}`;
      body = `Dear ${clientName}, this is your final reminder. Access to your project portal will be restricted after ${graceDate} if the invoice remains unpaid.`;
      break;
    case 3:
      subject = `Access Restored for ${clientName}`;
      body = `Dear ${clientName}, your payment has been successfully processed, and access to your project portal has been restored. Thank you!`;
      break;
    default:
      console.warn(`[notificationService] Unknown notification stage: ${stage}`);
      return;
  }

  console.log(`[notificationService] Sending email to ${clientEmail} (Stage ${stage}): ${subject}`);
  // In a real app, call email API here.
  
  return { success: true, subject };
}

export async function sendServiceStatusNotification(
    clientEmail: string,
    clientName: string,
    action: 'paused' | 'resumed',
    projectTitle?: string
) {
    let subject = '';
    let body = '';
    const target = projectTitle ? `on project: ${projectTitle}` : 'on your account';

    if (action === 'paused') {
        subject = `Important: Service Temporarily Paused ${target}`;
        body = `Dear ${clientName},

Active work ${target} has been temporarily paused by our team. Your client portal remains fully accessible, and you can view all project details, files, and billing history.

No action is required unless noted by your project manager. Please contact us if you have any questions.

Thank you,
The Custom Websites Plus Team`;
    } else if (action === 'resumed') {
        subject = `Update: Service Resumed ${target}`;
        body = `Dear ${clientName},

Active work ${target} has now resumed. We appreciate your patience and look forward to continuing your project.

You can track the latest progress in your client portal.

Thank you,
The Custom Websites Plus Team`;
    } else {
        return { success: false, message: 'Invalid action' };
    }

    console.log(`[notificationService] Sending service status email to ${clientEmail} (${action}): ${subject}`);
    // In a real app, call email API here.
    
    return { success: true, subject };
}

export async function sendInvoiceReminder(
    supabaseAdmin: any,
    invoiceId: string,
    clientEmail: string,
    clientName: string,
    invoiceAmount: number,
    hostedUrl: string,
    reminderType: 'upcoming' | 'overdue'
) {
    const subject = reminderType === 'upcoming' 
        ? `Reminder: Your Invoice for $${invoiceAmount.toFixed(2)} is Due Soon`
        : `URGENT: Invoice for $${invoiceAmount.toFixed(2)} is Past Due`;
        
    const body = `
Dear ${clientName},

This is a friendly reminder regarding your recent invoice for **$${invoiceAmount.toFixed(2)}**.

**Status:** ${reminderType === 'upcoming' ? 'Due Soon' : 'Past Due'}

Please click the link below to view and pay the invoice:

[View & Pay Invoice](${hostedUrl})

If you have already made this payment, please disregard this email. If you have any questions, please contact us immediately.

Thank you,
The Custom Websites Plus Team
`;

    console.log(`[notificationService] Sending ${reminderType} reminder for invoice ${invoiceId} to ${clientEmail}`);
    
    // Use the send-email Edge Function via AdminService or direct invocation
    // Since this is running in an Edge Function, we must use the AdminService pattern or direct DB insert/RPC call to trigger the email.
    
    // For simplicity and to avoid circular dependencies in Edge Functions, we will log the action and assume an external system (or another Edge Function) handles the actual sending based on the log.
    
    // For now, we will just log the action and update the invoice record.
    
    // In a real app, we would call the send-email function here.
    
    // Update the invoice record to mark the reminder sent
    await supabaseAdmin
        .from('invoices')
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq('id', invoiceId);
        
    return { success: true, subject };
}