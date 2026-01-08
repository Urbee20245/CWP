import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { sendInvoiceReminder } from '../_shared/notificationService.ts'; // Mocked notification service

// Helper to check if a date is within X days of today
const isWithinDays = (dateStr: string, days: number) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days && diffDays >= 0;
};

// Helper to check if a date is past due by X days
const isPastDueByDays = (dateStr: string, days: number) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= days;
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    console.log("[check-invoices-for-reminders] Starting invoice check.");

    // Fetch all open/past_due invoices that are NOT disabled
    const { data: invoices, error } = await supabaseAdmin
      .from('invoices')
      .select(`
        id, stripe_invoice_id, amount_due, status, hosted_invoice_url, due_date, last_reminder_sent_at,
        clients (business_name, billing_email, profiles (email))
      `)
      .in('status', ['open', 'past_due'])
      .eq('disable_reminders', false);

    if (error) {
      console.error('[check-invoices-for-reminders] DB fetch error:', error);
      return errorResponse('Failed to fetch invoices.', 500);
    }

    const now = new Date();
    const remindersSent: string[] = [];

    for (const invoice of invoices) {
      const client = invoice.clients;
      const clientEmail = client?.billing_email || client?.profiles?.email;
      const clientName = client?.business_name || 'Valued Client';
      const amount = invoice.amount_due / 100;
      const hostedUrl = invoice.hosted_invoice_url;
      const dueDate = invoice.due_date;
      const lastReminder = invoice.last_reminder_sent_at ? new Date(invoice.last_reminder_sent_at) : null;

      if (!dueDate || !clientEmail || !hostedUrl) {
        console.warn(`[check-invoices-for-reminders] Skipping invoice ${invoice.id}: Missing due date, email, or hosted URL.`);
        continue;
      }
      
      let shouldSend = false;
      let reminderType: 'upcoming' | 'overdue' | null = null;

      // Check 1: Upcoming Reminder (7 days before due date)
      if (invoice.status === 'open' && isWithinDays(dueDate, 7)) {
        if (!lastReminder || (now.getTime() - lastReminder.getTime()) > (24 * 60 * 60 * 1000)) { // Only send once per day
            shouldSend = true;
            reminderType = 'upcoming';
        }
      }

      // Check 2: Overdue Reminder (3 days past due date)
      if (invoice.status === 'past_due' && isPastDueByDays(dueDate, 3)) {
        if (!lastReminder || (now.getTime() - lastReminder.getTime()) > (3 * 24 * 60 * 60 * 1000)) { // Send every 3 days
            shouldSend = true;
            reminderType = 'overdue';
        }
      }

      if (shouldSend && reminderType) {
        await sendInvoiceReminder(
            supabaseAdmin,
            invoice.id,
            clientEmail,
            clientName,
            amount,
            hostedUrl,
            reminderType
        );
        remindersSent.push(`${reminderType} reminder sent for ${clientName} (Invoice ${invoice.id.substring(0, 8)})`);
      }
    }

    console.log(`[check-invoices-for-reminders] Check complete. Sent ${remindersSent.length} reminders.`);
    return jsonResponse({ success: true, remindersSent });

  } catch (error: any) {
    console.error('[check-invoices-for-reminders] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});