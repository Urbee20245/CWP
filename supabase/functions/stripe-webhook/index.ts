import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { sendBillingNotification } from '../_shared/notificationService.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error('Stripe secrets are not configured.');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let event: Stripe.Event;
  try {
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    
    if (!signature) {
        return errorResponse('Stripe signature missing.', 400);
    }

    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined, // Use default crypto provider
    );
  } catch (err: any) {
    console.error(`[stripe-webhook] Webhook signature verification failed: ${err.message}`);
    return errorResponse(`Webhook Error: ${err.message}`, 400);
  }

  console.log(`[stripe-webhook] Received event type: ${event.type}`);

  // Check for idempotency (prevent processing duplicate events)
  const { data: existingEvent } = await supabaseAdmin
    .from('payment_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single();

  if (existingEvent) {
    console.log(`[stripe-webhook] Event already processed: ${event.id}`);
    return jsonResponse({ received: true, message: 'Event already processed' });
  }

  try {
    const data = event.data.object as any;
    let client_id: string | null = null;
    let customer_id: string | null = null;

    // Determine customer ID and client ID
    if (data.customer) {
        customer_id = data.customer;
    } else if (data.object === 'invoice' && data.customer) {
        customer_id = data.customer;
    } else if (data.object === 'subscription' && data.customer) {
        customer_id = data.customer;
    }

    if (customer_id) {
        const { data: clientData } = await supabaseAdmin
            .from('clients')
            .select('id, business_name, billing_email')
            .eq('stripe_customer_id', customer_id)
            .single();
        client_id = clientData?.id || null;
    }

    // 1. Store event payload
    if (client_id) {
        const { error: eventError } = await supabaseAdmin
            .from('payment_events')
            .insert({
                client_id: client_id,
                stripe_event_id: event.id,
                type: event.type,
                payload: event.data,
            });
        if (eventError) console.error('[stripe-webhook] Failed to insert payment event:', eventError);
    }

    // 2. Handle specific events
    switch (event.type) {
      case 'invoice.paid':
      case 'checkout.session.completed': {
        if (!client_id) break;
        
        // Auto-Recovery Logic: Clear flags and restore access
        const { data: client, error: clientFetchError } = await supabaseAdmin
            .from('clients')
            .select('business_name, billing_email')
            .eq('id', client_id)
            .single();

        if (!clientFetchError && client) {
            await supabaseAdmin
                .from('clients')
                .update({
                    access_status: 'active',
                    billing_escalation_stage: 0,
                    billing_grace_until: null,
                    last_billing_notice_sent: null,
                })
                .eq('id', client_id);
            
            // Send confirmation email
            if (client.billing_email) {
                await sendBillingNotification(client.billing_email, client.business_name, 3);
            }
            console.log(`[stripe-webhook] Access restored for client ${client_id} due to successful payment.`);
        }
        
        // Fall through to invoice handling
      }
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.finalized':
      case 'invoice.created': {
        const invoice = data as Stripe.Invoice;
        if (!client_id) break;

        const invoiceData = {
          client_id: client_id,
          stripe_invoice_id: invoice.id,
          status: invoice.status,
          hosted_invoice_url: invoice.hosted_invoice_url,
          pdf_url: invoice.invoice_pdf,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        };

        const { error: upsertError } = await supabaseAdmin
          .from('invoices')
          .upsert(invoiceData, { onConflict: 'stripe_invoice_id' });

        if (upsertError) console.error('[stripe-webhook] Invoice upsert failed:', upsertError);
        
        // --- DEPOSIT & MILESTONE SYNC LOGIC (on payment success) ---
        if (event.type === 'invoice.payment_succeeded') {
            const paymentIntentId = invoice.payment_intent as string;
            
            // 1. Check if this invoice was for a DEPOSIT
            const { data: depositData } = await supabaseAdmin
                .from('deposits')
                .update({ 
                    status: 'paid',
                    stripe_payment_intent_id: paymentIntentId,
                })
                .eq('stripe_invoice_id', invoice.id)
                .select('id, project_id')
                .single();
            
            if (depositData) {
                console.log(`[stripe-webhook] Deposit ${depositData.id} marked as PAID.`);
                
                // If deposit is linked to a project, update project status
                if (depositData.project_id) {
                    await supabaseAdmin
                        .from('projects')
                        .update({ 
                            deposit_paid: true,
                            status: 'active' // Auto-activate project
                        })
                        .eq('id', depositData.project_id);
                    console.log(`[stripe-webhook] Project ${depositData.project_id} auto-activated.`);
                }
            }
            
            // 2. Check if this invoice was for a MILESTONE
            const milestoneId = invoice.metadata?.milestone_id;
            if (milestoneId) {
                await supabaseAdmin
                    .from('milestones')
                    .update({ status: 'paid' })
                    .eq('id', milestoneId);
                console.log(`[stripe-webhook] Milestone ${milestoneId} marked as PAID.`);
            }
            
        } else if (event.type === 'invoice.payment_failed') {
            // 1. Check if this invoice was for a DEPOSIT
            const { data: depositData } = await supabaseAdmin
                .from('deposits')
                .update({ status: 'failed' })
                .eq('stripe_invoice_id', invoice.id)
                .select('id')
                .single();
                
            if (depositData) {
                console.log(`[stripe-webhook] Deposit ${depositData.id} marked as FAILED.`);
            }
            
            // 2. Check if this invoice was for a MILESTONE
            const milestoneId = invoice.metadata?.milestone_id;
            if (milestoneId) {
                // Optionally revert milestone status if payment fails, or keep as 'invoiced'
                // For now, we keep it as 'invoiced' to indicate it's still due.
                console.log(`[stripe-webhook] Milestone ${milestoneId} payment FAILED.`);
            }
        }
        // --- END DEPOSIT & MILESTONE SYNC LOGIC ---
        
        // --- Access Restriction Logic on Failure ---
        if (event.type === 'invoice.payment_failed' && invoice.status === 'open') {
            const GRACE_PERIOD_DAYS = 7;
            const dueDate = invoice.due_date ? new Date(invoice.due_date * 1000) : new Date();
            const graceUntil = new Date(dueDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
            
            await supabaseAdmin
                .from('clients')
                .update({
                    access_status: 'grace',
                    billing_escalation_stage: 1, // Start escalation
                    billing_grace_until: graceUntil,
                    last_billing_notice_sent: new Date().toISOString(),
                })
                .eq('id', client_id);
            console.log(`[stripe-webhook] Client ${client_id} entered grace period due to payment failure.`);
        }
        
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = data as Stripe.Subscription;
        if (!client_id) break;

        const subscriptionData = {
          client_id: client_id,
          stripe_subscription_id: subscription.id,
          stripe_price_id: subscription.items.data[0]?.price.id,
          status: subscription.status,
          current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
        };

        const { error: upsertError } = await supabaseAdmin
          .from('subscriptions')
          .upsert(subscriptionData, { onConflict: 'stripe_subscription_id' });

        if (upsertError) console.error('[stripe-webhook] Subscription upsert failed:', upsertError);
        
        // Also update client record with the latest active subscription ID and access status
        if (subscription.status === 'active' || subscription.status === 'trialing') {
            await supabaseAdmin
                .from('clients')
                .update({ stripe_subscription_id: subscription.id, access_status: 'active' }) // Auto-restore access on active subscription
                .eq('id', client_id);
        } else if (event.type === 'customer.subscription.deleted' || subscription.status === 'canceled') {
             await supabaseAdmin
                .from('clients')
                .update({ stripe_subscription_id: null, access_status: 'restricted' }) // Restrict access on cancellation/deletion
                .eq('id', client_id);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return jsonResponse({ received: true });
  } catch (err: any) {
    console.error(`[stripe-webhook] Handler failed: ${err.message}`);
    return errorResponse(`Handler Error: ${err.message}`, 500);
  }
});