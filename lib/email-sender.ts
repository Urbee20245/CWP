/**
 * Stub helper for future email delivery.
 *
 * This repo currently has no email backend configured. Keep this module as a
 * placeholder so the Pro flow can be extended later without refactors.
 */
export async function sendReportEmail(_args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: false; reason: string }> {
  return { ok: false, reason: 'Email delivery is not configured in this project.' };
}

