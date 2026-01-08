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
    const { name, description, amount_cents, billing_type, currency = 'usd' } = await req.json();

    if (!name || !amount_cents || !billing_type) {
      return errorResponse('Missing required fields: name, amount_cents, or billing_type.', 400);
    }
    
    console.log(`[create-billing-product] Creating product: ${name} (${billing_type})`);

    // 1. Create Stripe Product
    const product = await stripe.products.create({
      name: name,
      description: description,
      default_price_data: {
        currency: currency,
        unit_amount: amount_cents,
        recurring: billing_type === 'subscription' ? { interval: 'month' } : undefined,
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
        amount_cents,
        currency,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[create-billing-product] Failed to insert into DB:', dbError);
      // Note: In a production system, we would also delete the Stripe product if DB insert fails.
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