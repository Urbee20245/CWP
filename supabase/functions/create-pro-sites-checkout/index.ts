export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

// ─── Pricing Constants ─────────────────────────────────────────────────────────

const TIER_PRICES: Record<string, number> = {
  starter: 9700,
  growth:  14700,
  pro:     19700,
  elite:   24700,
};

const SETUP_FEE_CENTS = 49700;

const ADDON_PRICES: Record<string, number> = {
  ai_phone_inbound:  5000,
  ai_phone_outbound: 3000,
  ai_chatbot:        4000,
  cal_booking:       2000,
  chat_widget:       1500,
  blog_2x:           3000,
  blog_4x:           5000,
  blog_weekly:       8000,
  legal_pages:       1500,
  google_calendar:   1000,
  client_backoffice: 2500,
};

const TIER_INCLUDED: Record<string, string[]> = {
  starter: [],
  growth:  ['cal_booking', 'chat_widget', 'blog_2x', 'legal_pages'],
  pro:     ['cal_booking', 'chat_widget', 'blog_2x', 'blog_4x', 'legal_pages', 'ai_phone_inbound', 'ai_chatbot'],
  elite:   ['cal_booking', 'chat_widget', 'blog_2x', 'blog_4x', 'blog_weekly', 'legal_pages', 'ai_phone_inbound', 'ai_chatbot', 'ai_phone_outbound'],
};

const TIER_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth:  'Growth',
  pro:     'Pro',
  elite:   'Elite',
};

const ADDON_NAMES: Record<string, string> = {
  ai_phone_inbound:  'Add-on: AI Phone Receptionist — Inbound (135 min/mo)',
  ai_phone_outbound: 'Add-on: AI Phone Receptionist — Outbound',
  ai_chatbot:        'Add-on: AI Chatbot',
  cal_booking:       'Add-on: Cal.com Booking Calendar',
  chat_widget:       'Add-on: Live Chat Widget',
  blog_2x:           'Add-on: Blog Automation (2 posts/month)',
  blog_4x:           'Add-on: Blog Automation (4 posts/month)',
  blog_weekly:       'Add-on: Weekly Blog Posts',
  legal_pages:       'Add-on: Legal Pages Bundle',
  google_calendar:   'Add-on: Google Calendar Sync',
  client_backoffice: 'Add-on: Client Back Office Portal',
};

// ─── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const {
      first_name,
      last_name,
      business_name,
      email,
      phone,
      industry,
      business_description,
      tier,
      selected_addons,
      success_url,
      cancel_url,
    } = body;

    // Validate required fields
    if (!first_name || !last_name || !business_name || !email || !industry || !tier || !success_url || !cancel_url) {
      return errorResponse('Missing required fields.', 400);
    }
    if (!TIER_PRICES[tier]) {
      return errorResponse('Invalid tier.', 400);
    }

    // Initialize clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    });

    // ── 1. Calculate pricing ──────────────────────────────────────────────────

    const includedInTier = TIER_INCLUDED[tier] || [];
    const billedAddons: string[] = (selected_addons as string[] || []).filter(
      (key: string) => !includedInTier.includes(key) && ADDON_PRICES[key] !== undefined
    );

    const addons_monthly_cents = billedAddons.reduce((sum: number, key: string) => {
      return sum + (ADDON_PRICES[key] || 0);
    }, 0);

    const monthly_cents = TIER_PRICES[tier];
    const total_monthly_cents = monthly_cents + addons_monthly_cents;

    // ── 2. Save pending record ────────────────────────────────────────────────

    const { data: checkoutRecord, error: insertError } = await supabaseAdmin
      .from('pro_sites_checkouts')
      .insert({
        first_name,
        last_name,
        business_name,
        email,
        phone: phone || null,
        industry,
        business_description: business_description || null,
        tier,
        selected_addons: billedAddons,
        setup_fee_cents: SETUP_FEE_CENTS,
        monthly_cents,
        addons_monthly_cents,
        total_monthly_cents,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !checkoutRecord) {
      console.error('[create-pro-sites-checkout] Failed to insert checkout record:', insertError);
      return errorResponse('Failed to create checkout record.', 500);
    }

    // ── 3. Build Stripe line items ────────────────────────────────────────────

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // One-time setup fee
    line_items.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'CWP Pro Sites — Setup Fee',
          description: 'One-time AI website build, integrations, configuration & launch',
        },
        unit_amount: SETUP_FEE_CENTS,
      },
      quantity: 1,
    });

    // Monthly tier subscription
    line_items.push({
      price_data: {
        currency: 'usd',
        recurring: { interval: 'month' },
        product_data: {
          name: `CWP Pro Sites — ${TIER_LABELS[tier]} Plan`,
          description: 'Monthly website hosting, maintenance & support',
        },
        unit_amount: monthly_cents,
      },
      quantity: 1,
    });

    // Add-on subscription items
    for (const addonKey of billedAddons) {
      const addonPrice = ADDON_PRICES[addonKey];
      if (!addonPrice) continue;

      line_items.push({
        price_data: {
          currency: 'usd',
          recurring: { interval: 'month' },
          product_data: {
            name: ADDON_NAMES[addonKey] || `Add-on: ${addonKey}`,
          },
          unit_amount: addonPrice,
        },
        quantity: 1,
      });
    }

    // ── 4. Create Stripe Checkout Session ─────────────────────────────────────

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items,
      customer_email: email,
      metadata: {
        payment_type: 'pro_sites',
        pro_sites_checkout_id: checkoutRecord.id,
        tier,
        selected_addons: JSON.stringify(billedAddons),
        business_name,
        industry,
      },
      subscription_data: {
        metadata: {
          payment_type: 'pro_sites',
          pro_sites_checkout_id: checkoutRecord.id,
          business_name,
          tier,
        },
      },
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
    });

    // ── 5. Update record with session ID ──────────────────────────────────────

    await supabaseAdmin
      .from('pro_sites_checkouts')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', checkoutRecord.id);

    // ── 6. Return checkout URL ────────────────────────────────────────────────

    return jsonResponse({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
    });

  } catch (err: any) {
    console.error('[create-pro-sites-checkout] Error:', err.message);
    return errorResponse(err.message || 'Internal server error.', 500);
  }
});
