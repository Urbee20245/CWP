export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

// ─── Tier metadata ─────────────────────────────────────────────────────────────

const TIER_INFO: Record<string, {
  label: string;
  monthlyPrice: number;
  phone_type: 'none' | 'inbound' | 'inbound_outbound';
  phone_detail: string;
}> = {
  starter: {
    label: 'Starter',
    monthlyPrice: 97,
    phone_type: 'none',
    phone_detail: 'AI Chat only. Upgrade to Growth for phone.',
  },
  growth: {
    label: 'Growth',
    monthlyPrice: 147,
    phone_type: 'inbound',
    phone_detail: 'AI Phone Receptionist — Inbound calls only.',
  },
  pro: {
    label: 'Pro',
    monthlyPrice: 197,
    phone_type: 'inbound_outbound',
    phone_detail: 'AI Phone — Inbound + Outbound calls.',
  },
  elite: {
    label: 'Elite',
    monthlyPrice: 247,
    phone_type: 'inbound_outbound',
    phone_detail: 'AI Phone — Inbound + Outbound calls.',
  },
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { token } = await req.json();

    if (!token) {
      return errorResponse('Token is required.', 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch checkout by token
    const { data: checkout, error: checkoutError } = await supabaseAdmin
      .from('pro_sites_checkouts')
      .select('id,first_name,last_name,business_name,email,phone,industry,tier,selected_addons,prefers_toll_free_number,status,client_id,onboarding_token')
      .eq('onboarding_token', token)
      .single();

    if (checkoutError || !checkout) {
      console.error('[get-pro-sites-checkout-by-token] Checkout not found for token:', token);
      return errorResponse('Invalid or expired setup link.', 404);
    }

    // 2. Build tier info
    const tierInfo = TIER_INFO[checkout.tier] || TIER_INFO.starter;

    // 3. Fetch included addons for this tier from catalog
    const { data: catalogAddons } = await supabaseAdmin
      .from('addon_catalog')
      .select('key,name,description,monthly_price_cents,billing_type,included_in_plans')
      .eq('is_active', true);

    const includedAddons = (catalogAddons || []).filter((a: any) =>
      Array.isArray(a.included_in_plans) && a.included_in_plans.includes(checkout.tier)
    ).map((a: any) => ({
      key: a.key,
      name: a.name,
      description: a.description,
      monthly_price_cents: a.monthly_price_cents,
      billing_type: a.billing_type,
    }));

    // 4. Fetch existing GEM progress
    const { data: progress } = await supabaseAdmin
      .from('pro_sites_gem_progress')
      .select('*')
      .eq('checkout_id', checkout.id)
      .single();

    return jsonResponse({
      checkout,
      tier_info: tierInfo,
      included_addons: includedAddons,
      progress: progress || null,
    });

  } catch (err: any) {
    console.error('[get-pro-sites-checkout-by-token] Error:', err.message);
    return errorResponse('Internal server error.', 500);
  }
});
