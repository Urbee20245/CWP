import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

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

  // Initialize Supabase client with service role for secure DB access
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, project_id, amount_cents, description, success_url, cancel_url } = await req.json();

    if (!client_id || !project_id || !amount_cents || !description || !success_url || !cancel_url) {
      return errorResponse('Missing required fields: client_id, project_id, amount_cents, description, success_url, or cancel_url.', 400);
    }
    
    console.log(`[create-deposit-checkout] Attempting to create checkout session for client ${client_id}`);

    // 1. Get Client Data (including existing Stripe ID and email)
    const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id, business_name, billing_email, owner_profile_id, stripe_customer_id, profiles(email)')
        .eq('id', client_id)
        .single();
        
    if (clientError || !client) {
        console.error('[create-deposit-checkout] Client lookup failed:', clientError?.message);
        return errorResponse('Client not found or unauthorized.', 404);
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
        console.error('[create-deposit-checkout] Failed to update client with Stripe ID:', updateError);
      }

      stripeCustomerId = customer.id;
      return stripeCustomerId;
    };
    
    const customerId = await ensureStripeCustomer();
    
    if (!customerId) {
        return errorResponse('Failed to retrieve or create Stripe customer.', 500);
    }

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: description,
                    description: `Project Deposit for ${client.business_name}`,
                },
                unit_amount: amount_cents,
            },
            quantity: 1,
        }],
        success_url: success_url,
        cancel_url: cancel_url,
        metadata: {
            supabase_client_id: client_id,
            supabase_project_id: project_id,
            payment_type: 'deposit',
        },
    });

    console.log(`[create-deposit-checkout] Checkout session created: ${session.id}`);
    return jsonResponse({ checkout_url: session.url });

  } catch (error: any) {
    console.error('[create-deposit-checkout] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});