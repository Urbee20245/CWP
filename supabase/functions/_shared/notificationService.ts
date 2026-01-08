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