import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { sendBillingNotification } from '../_shared/notificationService.ts';

// Define constants for escalation timing (in days)
const REMINDER_DAY = 1; // Send reminder 1 day after due date
const FINAL_NOTICE_DAY = 5; // Send final notice 5 days after due date
const GRACE_PERIOD_DAYS = 7; // Restrict access 7 days after due date

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  console.log("[billing-automation] Starting daily billing automation process.");

  try {
    // 1. Find all clients who are NOT overridden and have an open/past_due invoice
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select(`
        id, business_name, billing_email, access_override, 
        billing_escalation_stage, last_billing_notice_sent, billing_grace_until, access_status,
        invoices (id, status, due_date)
      `)
      .eq('access_override', false);

    if (clientsError) {
      console.error("[billing-automation] Error fetching clients:", clientsError);
      return errorResponse("Failed to fetch clients.", 500);
    }

    const now = new Date();
    const actions: any[] = [];

    for (const client of clients) {
      const overdueInvoice = client.invoices.find(inv => 
        (inv.status === 'open' || inv.status === 'past_due') && 
        inv.due_date && new Date(inv.due_date) < now
      );

      if (!overdueInvoice) {
        // If client has no overdue invoices, ensure they are active/reset flags
        if (client.access_status !== 'active' || client.billing_escalation_stage !== 0) {
            await supabaseAdmin.from('clients').update({
                access_status: 'active',
                billing_escalation_stage: 0,
                billing_grace_until: null,
                last_billing_notice_sent: null,
            }).eq('id', client.id);
            actions.push({ client: client.id, action: 'Reset_Flags', reason: 'No overdue invoice found' });
        }
        continue;
      }

      const dueDate = new Date(overdueInvoice.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentStage = client.billing_escalation_stage;
      const clientEmail = client.billing_email || client.profiles?.email;
      
      // Check if a notice was sent in the last 24 hours (idempotency check)
      const lastNotice = client.last_billing_notice_sent ? new Date(client.last_billing_notice_sent) : null;
      const sentRecently = lastNotice && (now.getTime() - lastNotice.getTime() < (1000 * 60 * 60 * 24));

      let updatePayload: any = {};
      let notificationStage: 1 | 2 | 3 | null = null;

      // --- Stage 3: Restrict Access (After Grace Period) ---
      if (daysOverdue > GRACE_PERIOD_DAYS && currentStage < 3) {
        updatePayload = {
          access_status: 'restricted',
          billing_escalation_stage: 3,
        };
        actions.push({ client: client.id, action: 'RESTRICTED', daysOverdue });
      } 
      // --- Stage 2: Final Reminder (5 days overdue) ---
      else if (daysOverdue >= FINAL_NOTICE_DAY && currentStage < 2 && !sentRecently) {
        const graceDate = new Date(dueDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
        updatePayload = {
          billing_escalation_stage: 2,
          last_billing_notice_sent: now.toISOString(),
          billing_grace_until: graceDate,
          access_status: 'grace', // Ensure status is grace
        };
        notificationStage = 2;
        actions.push({ client: client.id, action: 'Final_Notice', daysOverdue });
      }
      // --- Stage 1: First Reminder (1 day overdue) ---
      else if (daysOverdue >= REMINDER_DAY && currentStage < 1 && !sentRecently) {
        const graceDate = new Date(dueDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
        updatePayload = {
          billing_escalation_stage: 1,
          last_billing_notice_sent: now.toISOString(),
          billing_grace_until: graceDate,
          access_status: 'grace', // Set status to grace
        };
        notificationStage = 1;
        actions.push({ client: client.id, action: 'First_Reminder', daysOverdue });
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('clients')
          .update(updatePayload)
          .eq('id', client.id);

        if (updateError) {
          console.error(`[billing-automation] Failed to update client ${client.id}:`, updateError);
        }
      }
      
      if (notificationStage && clientEmail) {
        await sendBillingNotification(
          clientEmail, 
          client.business_name, 
          notificationStage, 
          client.billing_grace_until || updatePayload.billing_grace_until
        );
      }
    }

    console.log(`[billing-automation] Completed. Total actions: ${actions.length}`);
    return jsonResponse({ success: true, actions });

  } catch (error: any) {
    console.error('[billing-automation] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});