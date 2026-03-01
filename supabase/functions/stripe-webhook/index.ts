export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { sendBillingNotification, sendSubscriptionCreatedNotification } from '../_shared/notificationService.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error('Stripe secrets are not configured.');
}

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
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
    } else if (data.object === 'checkout.session' && data.customer) {
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
    
    // For checkout sessions, client_id might be in metadata if customer didn't exist yet
    if (!client_id && data.metadata?.supabase_client_id) {
        client_id = data.metadata.supabase_client_id;
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
      case 'invoice.payment_succeeded': {
        if (!client_id) break;
        
        // Auto-Recovery Logic: Clear flags
        const { data: client, error: clientFetchError } = await supabaseAdmin
            .from('clients')
            .select('business_name, billing_email')
            .eq('id', client_id)
            .single();

        if (!clientFetchError && client) {
            await supabaseAdmin
                .from('clients')
                .update({
                    last_billing_notice_sent: null,
                })
                .eq('id', client_id);
            
            // Send confirmation email
            if (client.billing_email) {
                await sendBillingNotification(client.billing_email, client.business_name, 3);
            }
            console.log(`[stripe-webhook] Billing flags reset for client ${client_id} due to successful payment.`);
        }
        
        // Fall through to invoice handling
      }
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

                // If deposit is linked to a project, update project status + SLA dates
                if (depositData.project_id) {
                    // Fetch sla_days to compute due date
                    const { data: projectData } = await supabaseAdmin
                        .from('projects')
                        .select('sla_days')
                        .eq('id', depositData.project_id)
                        .single();

                    const slaStartDate = new Date().toISOString();
                    const slaDueDate = projectData?.sla_days
                        ? new Date(Date.now() + projectData.sla_days * 24 * 60 * 60 * 1000).toISOString()
                        : null;

                    await supabaseAdmin
                        .from('projects')
                        .update({
                            deposit_paid: true,
                            status: 'active',
                            sla_start_date: slaStartDate,
                            ...(slaDueDate ? { sla_due_date: slaDueDate } : {}),
                        })
                        .eq('id', depositData.project_id);
                    console.log(`[stripe-webhook] Project ${depositData.project_id} auto-activated with SLA start ${slaStartDate}.`);

                    // Sync deposit_paid back to the linked proposal
                    await supabaseAdmin
                        .from('client_proposals')
                        .update({ deposit_paid: true })
                        .eq('project_id', depositData.project_id);
                    console.log(`[stripe-webhook] client_proposals.deposit_paid synced for project ${depositData.project_id}.`);
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

            // 3. Check if this invoice is a proposal deposit invoice — mark deposit_paid = true
            const { data: invoiceRow } = await supabaseAdmin
                .from('invoices')
                .select('id')
                .eq('stripe_invoice_id', invoice.id)
                .single();

            if (invoiceRow?.id) {
                const { data: proposalRow } = await supabaseAdmin
                    .from('client_proposals')
                    .update({ deposit_paid: true })
                    .eq('deposit_invoice_id', invoiceRow.id)
                    .select('id')
                    .single();

                if (proposalRow) {
                    console.log(`[stripe-webhook] Proposal ${proposalRow.id} deposit_paid set to true.`);
                }
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
                console.log(`[stripe-webhook] Milestone ${milestoneId} payment FAILED.`);
            }
        }
        // --- END DEPOSIT & MILESTONE SYNC LOGIC ---
        
        break;
      }
      
      case 'checkout.session.completed': {
        const session = data as Stripe.Checkout.Session;
        const metadata = session.metadata;

        // ── Pro Sites checkout ─────────────────────────────────────────────────
        if (metadata?.payment_type === 'pro_sites' && metadata.pro_sites_checkout_id) {
          const checkoutId = metadata.pro_sites_checkout_id;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          console.log(`[stripe-webhook] Pro Sites checkout completed: ${checkoutId}`);

          // 1. Update checkout to 'paid' and return the updated record in one query
          const { data: proCheckout, error: updateError } = await supabaseAdmin
            .from('pro_sites_checkouts')
            .update({
              status: 'paid',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            })
            .eq('id', checkoutId)
            .select('*')
            .single();

          if (updateError || !proCheckout) {
            console.error('[stripe-webhook] Failed to update pro_sites_checkout:', updateError);
            break;
          }

          // 2. Create client record if not already linked
          if (!proCheckout.client_id) {
            const { data: newClient } = await supabaseAdmin
              .from('clients')
              .insert({
                name: proCheckout.business_name,
                email: proCheckout.email,
                phone: proCheckout.phone || null,
                industry: proCheckout.industry || null,
                plan: proCheckout.tier,
                status: 'active',
              })
              .select('id')
              .single();

            if (newClient?.id) {
              await supabaseAdmin
                .from('pro_sites_checkouts')
                .update({ client_id: newClient.id })
                .eq('id', checkoutId);
            }
          }

          // 3. Send onboarding email with GEM link (guard against duplicates)
          if (!proCheckout.onboarding_email_sent_at) {
            const gemUrl = `https://customwebsitesplus.com/pro-sites/onboard?token=${proCheckout.onboarding_token}`;
            const tierLabel = proCheckout.tier.charAt(0).toUpperCase() + proCheckout.tier.slice(1);

            await supabaseAdmin.functions.invoke('send-email', {
              body: {
                to: proCheckout.email,
                subject: `Your CWP Pro Sites setup link is ready — complete your account now`,
                html: `
                  <h2>Welcome, ${proCheckout.first_name}! Your order is confirmed. 🎉</h2>
                  <p>We've received your payment for the <strong>${tierLabel} Plan</strong> and we're excited to get started on <strong>${proCheckout.business_name}</strong>.</p>
                  <p>To get the most out of your plan, please complete your setup using the link below:</p>
                  <p style="text-align:center;margin:32px 0;">
                    <a href="${gemUrl}" style="background:#2563EB;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;">
                      Complete Your Setup →
                    </a>
                  </p>
                  <p style="font-size:13px;color:#64748b;">This link is unique to your account. You can return to it at any time to pick up where you left off.</p>
                  <p>Questions? Call us at <strong>(470) 264-6256</strong> or reply to this email.</p>
                  <p>— The CWP Team</p>
                `,
              },
            });

            await supabaseAdmin
              .from('pro_sites_checkouts')
              .update({ onboarding_email_sent_at: new Date().toISOString() })
              .eq('id', checkoutId);
          }

          // 4. Notify admins via send-admin-notification
          const addonList = (proCheckout.selected_addons as string[] || []).join(', ') || 'None';
          const totalMonthly = proCheckout.total_monthly_cents
            ? ((proCheckout.total_monthly_cents) / 100).toFixed(2)
            : '—';

          await supabaseAdmin.functions.invoke('send-admin-notification', {
            body: {
              subject: `New Pro Sites Order — ${proCheckout.business_name}`,
              html: `
                <h2>New Pro Sites Order Received</h2>
                <p><strong>Business:</strong> ${proCheckout.business_name}</p>
                <p><strong>Industry:</strong> ${proCheckout.industry}</p>
                <p><strong>Contact:</strong> ${proCheckout.first_name} ${proCheckout.last_name}</p>
                <p><strong>Email:</strong> ${proCheckout.email}</p>
                <p><strong>Phone:</strong> ${proCheckout.phone || 'Not provided'}</p>
                <hr/>
                <p><strong>Plan:</strong> ${proCheckout.tier.toUpperCase()}</p>
                <p><strong>Add-ons:</strong> ${addonList}</p>
                <p><strong>Monthly Total:</strong> $${totalMonthly}/mo</p>
                <p><strong>Setup Fee Paid:</strong> $497</p>
                <hr/>
                <p><em>Go to Admin &gt; Pro Sites Orders to manage this order.</em></p>
              `,
            },
          });

          break; // Exit the switch case
        }
        // ── End Pro Sites checkout ─────────────────────────────────────────────

        if (metadata?.payment_type === 'deposit' && metadata.supabase_project_id && metadata.supabase_client_id) {
            const projectId = metadata.supabase_project_id;
            const clientId = metadata.supabase_client_id;
            const paymentIntentId = session.payment_intent as string;
            const amountCents = session.amount_total;
            
            console.log(`[stripe-webhook] Processing deposit checkout for project ${projectId}`);
            
            // 1. Record the payment in the payments table
            const { error: paymentError } = await supabaseAdmin
                .from('payments')
                .insert({
                    client_id: clientId,
                    stripe_payment_intent_id: paymentIntentId,
                    amount: amountCents,
                    currency: session.currency,
                    status: 'succeeded',
                });
            if (paymentError) console.error('[stripe-webhook] Failed to insert payment record:', paymentError);
            
            // 2. Create a deposit record (status: paid)
            const { data: depositRecord, error: depositInsertError } = await supabaseAdmin
                .from('deposits')
                .insert({
                    client_id: clientId,
                    project_id: projectId,
                    amount_cents: amountCents,
                    status: 'paid',
                    stripe_payment_intent_id: paymentIntentId,
                })
                .select('id')
                .single();
                
            if (depositInsertError) {
                console.error('[stripe-webhook] Failed to insert deposit record from checkout:', depositInsertError);
            } else {
                console.log(`[stripe-webhook] Deposit ${depositRecord.id} recorded as PAID.`);
            }
            
            // 3. Update project status + SLA dates
            const { data: projectForSla } = await supabaseAdmin
                .from('projects')
                .select('sla_days')
                .eq('id', projectId)
                .single();

            const slaStart = new Date().toISOString();
            const slaDue = projectForSla?.sla_days
                ? new Date(Date.now() + projectForSla.sla_days * 24 * 60 * 60 * 1000).toISOString()
                : null;

            await supabaseAdmin
                .from('projects')
                .update({
                    deposit_paid: true,
                    status: 'active',
                    sla_start_date: slaStart,
                    ...(slaDue ? { sla_due_date: slaDue } : {}),
                })
                .eq('id', projectId);
            console.log(`[stripe-webhook] Project ${projectId} auto-activated via checkout with SLA start ${slaStart}.`);

            // Sync deposit_paid back to the linked proposal
            await supabaseAdmin
                .from('client_proposals')
                .update({ deposit_paid: true })
                .eq('project_id', projectId);
            console.log(`[stripe-webhook] client_proposals.deposit_paid synced via checkout for project ${projectId}.`);
        }
        
        // Fall through to general success handling
        if (!client_id) break;
        
        // Auto-Recovery Logic: Clear flags
        const { data: client, error: clientFetchError } = await supabaseAdmin
            .from('clients')
            .select('business_name, billing_email')
            .eq('id', client_id)
            .single();

        if (!clientFetchError && client) {
            await supabaseAdmin
                .from('clients')
                .update({
                    last_billing_notice_sent: null,
                })
                .eq('id', client_id);
            
            // Send confirmation email
            if (client.billing_email) {
                await sendBillingNotification(client.billing_email, client.business_name, 3);
            }
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

        // Update client record with the latest active subscription ID (for reference, not access)
        if (subscription.status === 'active' || subscription.status === 'trialing') {
            await supabaseAdmin
                .from('clients')
                .update({ stripe_subscription_id: subscription.id })
                .eq('id', client_id);
        } else if (event.type === 'customer.subscription.deleted' || subscription.status === 'canceled') {
             await supabaseAdmin
                .from('clients')
                .update({ stripe_subscription_id: null })
                .eq('id', client_id);
        }

        // When a new subscription is created and requires first payment (status=incomplete),
        // notify the client via email with the payment link so they can activate immediately.
        if (event.type === 'customer.subscription.created' && subscription.status === 'incomplete') {
            const { data: clientRecord } = await supabaseAdmin
                .from('clients')
                .select('business_name, billing_email, profiles(email)')
                .eq('id', client_id)
                .single();

            const clientEmail = clientRecord?.billing_email || clientRecord?.profiles?.email;
            if (clientEmail && clientRecord) {
                // Find the latest open invoice for this customer to get the payment URL
                const { data: openInvoice } = await supabaseAdmin
                    .from('invoices')
                    .select('hosted_invoice_url')
                    .eq('client_id', client_id)
                    .eq('status', 'open')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // Also look up the plan name from billing_products
                const priceId = subscription.items.data[0]?.price.id;
                const { data: productRecord } = priceId ? await supabaseAdmin
                    .from('billing_products')
                    .select('name')
                    .eq('stripe_price_id', priceId)
                    .maybeSingle() : { data: null };

                const planName = productRecord?.name || 'Maintenance Plan';
                const invoiceUrl = openInvoice?.hosted_invoice_url;

                if (invoiceUrl) {
                    await sendSubscriptionCreatedNotification(
                        clientEmail,
                        clientRecord.business_name,
                        planName,
                        invoiceUrl
                    );
                    console.log(`[stripe-webhook] Subscription created notification sent to ${clientEmail}`);
                } else {
                    console.warn(`[stripe-webhook] No open invoice found for new subscription ${subscription.id} — skipping client notification`);
                }
            }
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