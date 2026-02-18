export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

const MIN_BUDGET_CENTS = 1000; // $10.00 minimum

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonRes({ error: 'Missing Authorization header' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return jsonRes({ error: 'Unauthorized' }, 401);

    const { budget_cents } = await req.json();

    if (typeof budget_cents !== 'number' || !Number.isInteger(budget_cents)) {
      return jsonRes({ error: 'budget_cents must be an integer' }, 400);
    }

    if (budget_cents < MIN_BUDGET_CENTS) {
      return jsonRes({ error: `Minimum budget is $${(MIN_BUDGET_CENTS / 100).toFixed(2)} (${MIN_BUDGET_CENTS} cents)` }, 400);
    }

    // Look up the client record for this user
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('owner_profile_id', user.id)
      .single();

    if (clientError || !clientRow) {
      return jsonRes({ error: 'No client record found for this user' }, 404);
    }

    const { error: updateError } = await supabaseAdmin
      .from('client_voice_integrations')
      .update({ voice_monthly_budget_cents: budget_cents })
      .eq('client_id', clientRow.id);

    if (updateError) {
      console.error('[set-voice-budget] DB update failed:', updateError);
      return jsonRes({ error: `Failed to update budget: ${updateError.message}` }, 500);
    }

    console.log(`[set-voice-budget] Budget updated for client ${clientRow.id}: ${budget_cents} cents`);

    return jsonRes({ success: true, budget_cents, budget_dollars: budget_cents / 100 });

  } catch (error: any) {
    console.error('[set-voice-budget] Unhandled error:', error.message);
    return jsonRes({ error: error.message }, 500);
  }
});
