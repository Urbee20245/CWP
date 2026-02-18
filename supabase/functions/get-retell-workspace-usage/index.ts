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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Verify JWT (client or admin)
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

    const { client_id, year, month } = await req.json();

    if (!client_id) return jsonRes({ error: 'Missing required field: client_id' }, 400);

    // Resolve which client_id to use — admin can pass any, client must own it
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      // Client can only access their own data
      const { data: clientRow } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('owner_profile_id', user.id)
        .single();

      if (!clientRow || clientRow.id !== client_id) {
        return jsonRes({ error: 'Unauthorized: client_id does not match your account' }, 403);
      }
    }

    // Fetch workspace credentials and budget from DB
    const { data: voiceRow, error: voiceError } = await supabaseAdmin
      .from('client_voice_integrations')
      .select('retell_workspace_api_key, voice_monthly_budget_cents, voice_budget_alert_sent_at, voice_status')
      .eq('client_id', client_id)
      .maybeSingle();

    if (voiceError) {
      console.error('[get-retell-workspace-usage] DB error:', voiceError);
      return jsonRes({ error: 'Failed to fetch voice integration data' }, 500);
    }

    if (!voiceRow?.retell_workspace_api_key) {
      return jsonRes({
        voice_active: false,
        total_calls: 0,
        total_minutes: 0,
        budget_cents: voiceRow?.voice_monthly_budget_cents ?? 1000,
      });
    }

    // Build date range for the requested month (defaults to current month)
    const now = new Date();
    const targetYear = year ?? now.getUTCFullYear();
    const targetMonth = month ?? (now.getUTCMonth() + 1); // 1-indexed

    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const startMs = startOfMonth.getTime();
    const endMs = endOfMonth.getTime();

    // Call Retell API: list-calls with date filter
    // Retell expects start_timestamp and end_timestamp as unix ms integers
    let retellCalls: any[] = [];
    let cursor: string | null = null;

    do {
      const body: any = {
        filter_criteria: [
          {
            start_timestamp: [startMs, endMs],
          }
        ],
        limit: 1000,
      };
      if (cursor) body.pagination_key = cursor;

      const retellRes = await fetch('https://api.retellai.com/v2/list-calls', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${voiceRow.retell_workspace_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!retellRes.ok) {
        const errText = await retellRes.text();
        console.error('[get-retell-workspace-usage] Retell API error:', retellRes.status, errText);
        return jsonRes({ error: `Retell API error (${retellRes.status}): ${errText}` }, 502);
      }

      const retellData = await retellRes.json();
      const calls = Array.isArray(retellData) ? retellData : (retellData.calls ?? []);
      retellCalls = retellCalls.concat(calls);
      cursor = retellData.pagination_key ?? null;
    } while (cursor);

    // Aggregate: total_calls and total_minutes (from duration_ms)
    const totalCalls = retellCalls.length;
    const totalMinutes = retellCalls.reduce((sum: number, call: any) => {
      const ms = call.duration_ms ?? call.call_length ?? 0;
      return sum + ms / 60000;
    }, 0);

    const budgetCents = voiceRow.voice_monthly_budget_cents ?? 1000;

    // Check if we need to send a 90% budget alert
    // Cost estimate: Retell charges ~$0.05/min; we store usage in minutes for display
    // The alert is purely based on minutes relative to the budget the client set
    // We flag at 90%+ usage — the threshold here is usage minutes relative to the budget cents
    // Since we don't know the per-minute rate, we pass raw numbers to frontend for display
    // Alert: if we have a way to compute %, do it. Otherwise just let the frontend handle display.
    // We check voice_budget_alert_sent_at to avoid resending within the same month.
    const alertSentAt = voiceRow.voice_budget_alert_sent_at;
    const alertSentThisMonth = alertSentAt
      ? (() => {
          const d = new Date(alertSentAt);
          return d.getUTCFullYear() === targetYear && (d.getUTCMonth() + 1) === targetMonth;
        })()
      : false;

    // Fetch client email for alert if needed
    if (!alertSentThisMonth) {
      // We can't easily compute % without knowing per-minute rate,
      // so we send the alert if total_minutes suggests spend >= 90% of budget.
      // Estimated spend: use a placeholder rate of $0.05/min to check threshold.
      // Admin can adjust this in future. For now this is the trigger logic.
      const estimatedSpendCents = Math.round(totalMinutes * 5); // $0.05/min
      const usagePct = budgetCents > 0 ? estimatedSpendCents / budgetCents : 0;

      if (usagePct >= 0.9) {
        // Fetch client email
        const { data: clientRow } = await supabaseAdmin
          .from('clients')
          .select('owner_profile_id, business_name')
          .eq('id', client_id)
          .single();

        if (clientRow) {
          const { data: profileRow } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('id', clientRow.owner_profile_id)
            .single();

          if (profileRow?.email) {
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (resendApiKey) {
              const pctDisplay = Math.round(usagePct * 100);
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'noreply@customwebsitesplus.com',
                  to: profileRow.email,
                  subject: `AI Voice Usage Alert: ${pctDisplay}% of your monthly budget used`,
                  html: `<p>Hi ${profileRow.full_name || 'there'},</p>
<p>Your AI Voice usage has reached <strong>${pctDisplay}%</strong> of your monthly budget of <strong>$${(budgetCents / 100).toFixed(2)}</strong>.</p>
<p>You can increase your budget at any time from your <a href="${Deno.env.get('SITE_URL') ?? 'https://app.customwebsitesplus.com'}/client/billing">Billing page</a>.</p>
<p>— Custom Websites Plus</p>`,
                }),
              }).catch(e => console.error('[get-retell-workspace-usage] Email send failed:', e));
            }

            // Mark alert sent
            await supabaseAdmin
              .from('client_voice_integrations')
              .update({ voice_budget_alert_sent_at: new Date().toISOString() })
              .eq('client_id', client_id);
          }
        }
      }
    }

    return jsonRes({
      voice_active: true,
      total_calls: totalCalls,
      total_minutes: Math.round(totalMinutes * 10) / 10,
      budget_cents: budgetCents,
    });

  } catch (error: any) {
    console.error('[get-retell-workspace-usage] Unhandled error:', error.message);
    return jsonRes({ error: error.message }, 500);
  }
});
