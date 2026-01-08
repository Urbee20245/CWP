import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_CUSTOMER_PORTAL_RETURN_URL = Deno.env.get('STRIPE_CUSTOMER_PORTAL_RETURN_URL');
const STRIPE_SUCCESS_URL = Deno.env.get('STRIPE_SUCCESS_URL');
const STRIPE_CANCEL_URL = Deno.env.get('STRIPE_CANCEL_URL');

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set.');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const path = url.pathname.replace('/stripe-api', '');

  // Initialize Supabase client with service role for secure DB access
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, price_id, line_items, due_date, deposit_details, milestone_details } = await req.json();

    if (path !== '/create-portal-session' && !client_id) {
      return errorResponse('Client ID is required.', 400);
    }

    // 1. Get Client Data (including existing Stripe ID and email)
    let client;
    if (client_id) {
        const { data: clientData, error: clientError } = await supabaseAdmin
          .from('clients')
          .select('id, business_name, billing_email, owner_profile_id, stripe_customer_id')
          .eq('id', client_id)
          .single();
        
        if (clientError || !clientData) {
          console.error('[stripe-api] Client lookup failed:', clientError?.message);
          return errorResponse('Client not found.', 404);
        }
        client = clientData;
    }


    let stripeCustomerId = client?.stripe_customer_id;
    const clientEmail = client?.billing_email || client?.profiles?.email;

    // --- Helper to ensure Stripe Customer exists ---
    const ensureStripeCustomer = async () => {
      if (stripeCustomerId) return stripeCustomerId;

      if (!clientEmail) {
        return errorResponse('Client email is required to create Stripe customer.', 400);
      }

      const customer = await stripe.customers.create({
        email: clientEmail,
        name: client.business_name,
        metadata: {
          supabase_client_id: client.id,
          supabase_profile_id: client.owner_profile_id,
        },
      });

      // Update Supabase with new Stripe Customer ID
      const { error: updateError } = await supabaseAdmin
        .from('clients')
        .update({ stripe_customer_id: customer.id })
        .eq('id', client.id);

      if (updateError) {
        console.error('[stripe-api] Failed to update client with Stripe ID:', updateError);
        // Proceed anyway, but log the error
      }

      stripeCustomerId = customer.id;
      return stripeCustomerId;
    };
    
    // --- Helper to apply unapplied deposits as credit ---
    const applyUnappliedDeposits = async (customerId: string, newInvoiceId: string) => {
        const { data: depositsToApply, error: depositFetchError } = await supabaseAdmin
            .from('deposits')
            .select('id, amount_cents')
            .eq('client_id', client_id)
            .eq('status', 'paid')
            .is('applied_to_invoice_id', null)
            .order('created_at', { ascending: true });

        if (depositFetchError) {
            console.error('[stripe-api] Error fetching deposits to apply:', depositFetchError);
            return;
        }
        
        if (depositsToApply && depositsToApply.length > 0) {
            console.log(`[stripe-api] Applying ${depositsToApply.length} unapplied deposits as credit.`);
            
            for (const deposit of depositsToApply) {
                // 1. Create a negative invoice item (credit)
                await stripe.invoiceItems.create({
                    customer: customerId,
                    unit_amount: -deposit.amount_cents, // Negative amount for credit
                    currency: 'usd',
                    description: `Deposit Credit Applied (ID: ${deposit.id})`,
                    invoice: newInvoiceId,
                });
                
                // 2. Update deposit status in DB
                await supabaseAdmin
                    .from('deposits')
                    .update({ 
                        status: 'applied', 
                        applied_to_invoice_id: newInvoiceId 
                    })
                    .eq('id', deposit.id);
            }
        }
    };


    // --- Route Handling ---
    switch (path) {
      case '/create-customer': {
        const customerId = await ensureStripeCustomer();
        return jsonResponse({ stripe_customer_id: customerId });
      }

      case '/create-subscription': {
        if (!price_id) return errorResponse('Price ID is required.', 400);
        const customerId = await ensureStripeCustomer();

        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: price_id }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
        });
        
        // If an invoice was created immediately, apply deposits to it
        if (subscription.latest_invoice && typeof subscription.latest_invoice !== 'string') {
            await applyUnappliedDeposits(customerId, subscription.latest_invoice.id);
        }

        // If payment is required, return the invoice URL
        if (subscription.latest_invoice && typeof subscription.latest_invoice !== 'string') {
          const invoice = subscription.latest_invoice;
          if (invoice.payment_intent && typeof invoice.payment_intent !== 'string' && invoice.payment_intent.status === 'requires_action') {
            return jsonResponse({ 
              subscription_id: subscription.id,
              status: subscription.status,
              hosted_invoice_url: invoice.hosted_invoice_url,
              requires_action: true,
            });
          }
        }
        
        // If no immediate payment required (e.g., free trial or successful first payment)
        return jsonResponse({ 
          subscription_id: subscription.id,
          status: subscription.status,
          requires_action: false,
        });
      }

      case '/create-invoice': {
        if (!line_items || line_items.length === 0) return errorResponse('Line items are required.', 400);
        const customerId = await ensureStripeCustomer();

        // 1. Create Invoice
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: due_date ? Math.ceil((new Date(due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 7,
        });
        
        // 2. Apply deposits as credit to the new invoice
        await applyUnappliedDeposits(customerId, invoice.id);

        // 3. Create Invoice Items
        for (const item of line_items) {
          await stripe.invoiceItems.create({
            customer: customerId,
            price_data: {
              currency: 'usd',
              product_data: { name: item.description },
              unit_amount: item.amount * 100, // Convert to cents
            },
            invoice: invoice.id, // Attach to the specific invoice
          });
        }

        // 4. Finalize and Send
        const finalizedInvoice = await stripe.invoices.sendInvoice(invoice.id);

        // 5. Store in Supabase (Webhook will handle the final status update, but we store the initial record)
        const { error: invoiceInsertError } = await supabaseAdmin
          .from('invoices')
          .insert({
            client_id: client.id,
            stripe_invoice_id: finalizedInvoice.id,
            status: finalizedInvoice.status,
            hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
            pdf_url: finalizedInvoice.invoice_pdf,
            amount_due: finalizedInvoice.amount_due,
            currency: finalizedInvoice.currency,
            due_date: finalizedInvoice.due_date ? new Date(finalizedInvoice.due_date * 1000).toISOString() : null,
          });

        if (invoiceInsertError) {
          console.error('[stripe-api] Failed to insert initial invoice record:', invoiceInsertError);
        }

        return jsonResponse({ 
          invoice_id: finalizedInvoice.id,
          hosted_url: finalizedInvoice.hosted_invoice_url,
          status: finalizedInvoice.status,
        });
      }
      
      case '/create-deposit-invoice': {
        if (!deposit_details || !deposit_details.amount || !deposit_details.description) {
            return errorResponse('Deposit amount and description are required.', 400);
        }
        const customerId = await ensureStripeCustomer();
        const { amount, description, project_id } = deposit_details;
        const amountCents = Math.round(amount * 100);
        
        // 1. Create initial deposit record (status: pending)
        const { data: depositRecord, error: depositInsertError } = await supabaseAdmin
            .from('deposits')
            .insert({
                client_id: client.id,
                project_id: project_id || null, // Link to project if provided
                amount_cents: amountCents,
                status: 'pending',
            })
            .select()
            .single();
            
        if (depositInsertError) {
            console.error('[stripe-api] Failed to insert deposit record:', depositInsertError);
            return errorResponse('Failed to create deposit record.', 500);
        }
        
        // 2. Create Stripe Invoice Item
        const invoiceItem = await stripe.invoiceItems.create({
            customer: customerId,
            price_data: {
                currency: 'usd',
                product_data: { name: `Deposit: ${description}` },
                unit_amount: amountCents,
            },
            description: `Deposit for project ${project_id ? project_id : 'services'} (Deposit ID: ${depositRecord.id})`,
        });
        
        // 3. Create and Finalize Invoice
        const invoice = await stripe.invoices.create({
            customer: customerId,
            collection_method: 'send_invoice',
            auto_advance: true, // Automatically transition to open/paid
            days_until_due: 0, // Due immediately
            metadata: {
                deposit_id: depositRecord.id,
            },
        });
        
        // Attach invoice item to the new invoice
        await stripe.invoiceItems.update(invoiceItem.id, { invoice: invoice.id });
        
        const finalizedInvoice = await stripe.invoices.sendInvoice(invoice.id);
        
        // 4. Update deposit record with Stripe IDs
        const { error: depositUpdateError } = await supabaseAdmin
            .from('deposits')
            .update({
                stripe_invoice_id: finalizedInvoice.id,
            })
            .eq('id', depositRecord.id);
            
        if (depositUpdateError) {
            console.error('[stripe-api] Failed to update deposit record with invoice ID:', depositUpdateError);
        }
        
        // 5. Store Invoice in Supabase (for history)
        const { error: invoiceInsertError } = await supabaseAdmin
          .from('invoices')
          .insert({
            client_id: client.id,
            stripe_invoice_id: finalizedInvoice.id,
            status: finalizedInvoice.status,
            hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
            pdf_url: finalizedInvoice.invoice_pdf,
            amount_due: finalizedInvoice.amount_due,
            currency: finalizedInvoice.currency,
            due_date: finalizedInvoice.due_date ? new Date(finalizedInvoice.due_date * 1000).toISOString() : null,
          });

        if (invoiceInsertError) {
          console.error('[stripe-api] Failed to insert initial deposit invoice record:', invoiceInsertError);
        }

        return jsonResponse({ 
          deposit_id: depositRecord.id,
          invoice_id: finalizedInvoice.id,
          hosted_url: finalizedInvoice.hosted_invoice_url,
          status: finalizedInvoice.status,
        });
      }
      
      case '/create-milestone-invoice': {
        if (!milestone_details || !milestone_details.milestone_id || !milestone_details.amount_cents || !milestone_details.description) {
            return errorResponse('Milestone details are required.', 400);
        }
        const customerId = await ensureStripeCustomer();
        const { milestone_id, amount_cents, description, project_id } = milestone_details;
        
        // 1. Create Invoice
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: 7, // Default 7 days for milestones
          metadata: {
              milestone_id: milestone_id,
              project_id: project_id,
          },
        });
        
        // 2. Apply deposits as credit to the new invoice
        await applyUnappliedDeposits(customerId, invoice.id);

        // 3. Create Invoice Item for milestone
        await stripe.invoiceItems.create({
            customer: customerId,
            price_data: {
                currency: 'usd',
                product_data: { name: description },
                unit_amount: amount_cents,
            },
            description: `Milestone: ${description}`,
            invoice: invoice.id,
        });

        // 4. Finalize and Send
        const finalizedInvoice = await stripe.invoices.sendInvoice(invoice.id);
        
        // 5. Update Milestone status and store invoice ID
        await supabaseAdmin
            .from('milestones')
            .update({ 
                status: 'invoiced', 
                stripe_invoice_id: finalizedInvoice.id 
            })
            .eq('id', milestone_id);

        // 6. Store Invoice in Supabase
        const { error: invoiceInsertError } = await supabaseAdmin
          .from('invoices')
          .insert({
            client_id: client.id,
            stripe_invoice_id: finalizedInvoice.id,
            status: finalizedInvoice.status,
            hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
            pdf_url: finalizedInvoice.invoice_pdf,
            amount_due: finalizedInvoice.amount_due,
            currency: finalizedInvoice.currency,
            due_date: finalizedInvoice.due_date ? new Date(finalizedInvoice.due_date * 1000).toISOString() : null,
          });

        if (invoiceInsertError) {
          console.error('[stripe-api] Failed to insert initial milestone invoice record:', invoiceInsertError);
        }

        return jsonResponse({ 
          milestone_id: milestone_id,
          invoice_id: finalizedInvoice.id,
          hosted_url: finalizedInvoice.hosted_invoice_url,
          status: finalizedInvoice.status,
        });
      }

      case '/create-portal-session': {
        if (!STRIPE_CUSTOMER_PORTAL_RETURN_URL) return errorResponse('Portal return URL not configured.', 500);
        const customerId = await ensureStripeCustomer();

        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: STRIPE_CUSTOMER_PORTAL_RETURN_URL,
        });

        return jsonResponse({ portal_url: session.url });
      }

      default:
        return errorResponse('Not Found', 404);
    }
  } catch (error: any) {
    console.error('[stripe-api] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});