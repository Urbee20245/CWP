import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse('Client ID is required.', 400);
    }

    // 1. Fetch Client Data (including override status, grace period, and status)
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('access_override, access_status, billing_grace_until')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      console.error('[access-check] Client lookup failed:', clientError?.message);
      return errorResponse('Client not found.', 404);
    }

    // 2. Check Admin Override (Rule 1)
    if (client.access_override) {
      return jsonResponse({ hasAccess: true, reason: 'override', graceUntil: client.billing_grace_until });
    }

    // 3. Check for Active Subscriptions (Rule 2)
    const { count: activeSubsCount, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client_id)
      .in('status', ['active', 'trialing']);

    if (subsError) {
      console.error('[access-check] Subscription check failed:', subsError);
      // Default to restricted if we can't verify status securely
      return jsonResponse({ hasAccess: false, reason: 'system_error', graceUntil: client.billing_grace_until });
    }

    const hasActiveSubscription = (activeSubsCount || 0) > 0;

    // 4. Check for Overdue Invoices (Rule 3 - used to trigger grace/restriction)
    const { data: overdueInvoices, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, status, due_date')
      .eq('client_id', client_id)
      .in('status', ['open', 'past_due', 'unpaid']);
      
    if (invoiceError) {
      console.error('[access-check] Invoice check failed:', invoiceError);
      return jsonResponse({ hasAccess: false, reason: 'system_error', graceUntil: client.billing_grace_until });
    }

    const now = new Date();
    const isOverdue = overdueInvoices.some(invoice => 
        invoice.status === 'past_due' || 
        (invoice.status === 'open' && invoice.due_date && new Date(invoice.due_date) < now)
    );

    // --- Final Access Logic ---
    
    // Check if we are in the grace period (access granted temporarily)
    const inGracePeriod = client.billing_grace_until && new Date(client.billing_grace_until) > now;

    if (hasActiveSubscription && !isOverdue) {
      return jsonResponse({ hasAccess: true, reason: 'active', graceUntil: client.billing_grace_until });
    }
    
    if (isOverdue && inGracePeriod) {
        // Overdue but still in grace period
        return jsonResponse({ hasAccess: true, reason: 'grace_period', graceUntil: client.billing_grace_until });
    }

    if (isOverdue && !inGracePeriod) {
      // If overdue and grace period expired
      return jsonResponse({ hasAccess: false, reason: 'overdue', graceUntil: client.billing_grace_until });
    }
    
    if (!hasActiveSubscription) {
      // If no active subscription (and no overdue invoice to trigger grace)
      return jsonResponse({ hasAccess: false, reason: 'no_subscription', graceUntil: client.billing_grace_until });
    }

    // Should be unreachable if logic is sound, but default to restricted
    return jsonResponse({ hasAccess: false, reason: 'restricted', graceUntil: client.billing_grace_until });

  } catch (error: any) {
    console.error('[access-check] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});