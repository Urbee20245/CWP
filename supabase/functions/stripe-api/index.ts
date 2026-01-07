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
    const { client_id, price_id, line_items, due_date } = await req.json();

    if (!client_id) {
      return errorResponse('Client ID is required.', 400);
    }

    // 1. Get Client Data (including existing Stripe ID and email)
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, business_name, billing_email, owner_profile_id, stripe_customer_id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      console.error('[stripe-api] Client lookup failed:', clientError?.message);
      return errorResponse('Client not found.', 404);
    }

    let stripeCustomerId = client.stripe_customer_id;
    const clientEmail = client.billing_email || client.profiles?.email;

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

        // 1. Create Invoice Items
        for (const item of line_items) {
          await stripe.invoiceItems.create({
            customer: customerId,
            price_data: {
              currency: 'usd',
              product_data: { name: item.description },
              unit_amount: item.amount * 100, // Convert to cents
            },
          });
        }

        // 2. Create Invoice
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: due_date ? Math.ceil((new Date(due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 7,
        });

        // 3. Finalize and Send
        const finalizedInvoice = await stripe.invoices.sendInvoice(invoice.id);

        // 4. Store in Supabase (Webhook will handle the final status update, but we store the initial record)
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