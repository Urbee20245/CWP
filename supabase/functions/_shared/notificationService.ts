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