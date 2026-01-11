import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!STRIPE_SECRET_KEY) {
      console.error('[create-billing-product] STRIPE_SECRET_KEY missing');
      return new Response(
        JSON.stringify({ error: 'Stripe configuration missing' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2020-08-27',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { name, description, amount_cents, billing_type, setup_fee_cents, monthly_price_cents, currency = 'usd' } = await req.json();

    if (!name || !billing_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name or billing_type' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // --- Determine amounts for Stripe and DB ---
    let stripeUnitAmount = 0;
    let dbAmountCents = null;
    let dbSetupFeeCents = null;
    let dbMonthlyPriceCents = null;

    if (billing_type === 'one_time') {
        stripeUnitAmount = amount_cents || 0;
        dbAmountCents = amount_cents;
    } else if (billing_type === 'subscription') {
        stripeUnitAmount = monthly_price_cents || 0;
        dbMonthlyPriceCents = monthly_price_cents;
    } else if (billing_type === 'setup_plus_subscription') {
        // Stripe requires a default price, use the monthly price for the subscription object
        stripeUnitAmount = monthly_price_cents || 0;
        dbSetupFeeCents = setup_fee_cents;
        dbMonthlyPriceCents = monthly_price_cents;
    }
    
    if (stripeUnitAmount <= 0 && billing_type !== 'setup_plus_subscription') {
      if (billing_type === 'one_time' || billing_type === 'subscription') {
        return new Response(
          JSON.stringify({ error: 'Price must be greater than zero for this billing type' }),
          { status: 400, headers: corsHeaders }
        );
      }
    }
    
    console.log(`[create-billing-product] Creating product: ${name} (${billing_type})`);

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

    const { data: dbProduct, error: dbError } = await supabaseAdmin
      .from('billing_products')
      .insert({
        name,
        description,
        billing_type,
        amount_cents: dbAmountCents, // Corrected: NULL for subscription types
        setup_fee_cents: dbSetupFeeCents,
        monthly_price_cents: dbMonthlyPriceCents,
        currency,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[create-billing-product] DB error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to save product to database' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`[create-billing-product] Success. Product: ${stripeProductId}`);
    return new Response(
      JSON.stringify({ success: true, product: dbProduct }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[create-billing-product] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Product creation failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
});