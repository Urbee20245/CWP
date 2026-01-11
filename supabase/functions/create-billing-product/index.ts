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

  // Initialize Supabase client with service role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { name, description, amount_cents, billing_type, setup_fee_cents, monthly_price_cents, currency = 'usd' } = await req.json();

    if (!name || !billing_type) {
      return errorResponse('Missing required fields: name or billing_type.', 400);
    }
    
    // Determine the primary amount for Stripe's default price creation.
    // Stripe requires a default price, so we use the monthly price if available, otherwise the one-time amount.
    const stripeUnitAmount = monthly_price_cents || amount_cents || 0;
    
    if (stripeUnitAmount <= 0 && billing_type !== 'setup_plus_subscription') {
        // Only enforce amount_cents if it's a simple one-time or subscription product
        if (billing_type === 'one_time' || billing_type === 'subscription') {
            return errorResponse('Amount must be greater than zero for this billing type.', 400);
        }
    }
    
    console.log(`[create-billing-product] Creating product: ${name} (${billing_type})`);

    // 1. Create Stripe Product
    const product = await stripe.products.create({
      name: name,
      description: description,
      default_price_data: {
        currency: currency,
        unit_amount: stripeUnitAmount,
        recurring: (billing_type === 'subscription' || billing_type === 'setup_plus_subscription') ? { interval: 'month' } : undefined,
      },
      expand: ['default_price'],
    });

    const stripeProductId = product.id;
    const stripePriceId = (product.default_price as Stripe.Price).id;

    // 2. Store in Supabase
    const { data: dbProduct, error: dbError } = await supabaseAdmin
      .from('billing_products')
      .insert({
        name,
        description,
        billing_type,
        amount_cents: amount_cents, // One-time price
        setup_fee_cents: setup_fee_cents, // New setup fee
        monthly_price_cents: monthly_price_cents, // New monthly price
        currency,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[create-billing-product] Failed to insert into DB:', dbError);
      return errorResponse('Failed to save product to database.', 500);
    }

    console.log(`[create-billing-product] Success. Product ID: ${stripeProductId}, Price ID: ${stripePriceId}`);
    return jsonResponse({ 
      success: true, 
      product: dbProduct,
    });

  } catch (error: any) {
    console.error('[create-billing-product] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});