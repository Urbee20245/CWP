// Edge Function: process-scheduled-calls
// Purpose: Cron job to process scheduled Retell AI calls
// Runs every minute to check for calls that need to be made

export const config = {
  auth: false, // Cron jobs use service role authentication
};

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

async function processScheduledCalls(supabaseAdmin: any) {
  // Find all pending calls that are due
  const now = new Date();
  const { data: pendingCalls, error: fetchErr } = await supabaseAdmin
    .from('retell_scheduled_calls')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_time', now.toISOString())
    .order('scheduled_time', { ascending: true })
    .limit(10); // Process max 10 calls per minute

  if (fetchErr) {
    console.error('[process-scheduled-calls] Error fetching pending calls', { error: fetchErr });
    return { error: fetchErr.message, processed: 0 };
  }

  if (!pendingCalls || pendingCalls.length === 0) {
    console.log('[process-scheduled-calls] No pending calls to process');
    return { processed: 0, message: 'No pending calls' };
  }

  console.log('[process-scheduled-calls] Found pending calls', { count: pendingCalls.length });

  const results = [];
  const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
  if (!RETELL_API_KEY) {
    console.error('[process-scheduled-calls] Missing RETELL_API_KEY');
    return { error: 'RETELL_API_KEY not configured', processed: 0 };
  }

  for (const call of pendingCalls) {
    try {
      console.log('[process-scheduled-calls] Processing call', {
        id: call.id,
        prospect: call.prospect_name,
        scheduled_time: call.scheduled_time,
      });

      // Update status to "calling"
      await supabaseAdmin
        .from('retell_scheduled_calls')
        .update({
          status: 'calling',
          call_started_at: now.toISOString(),
        })
        .eq('id', call.id);

      // Prepare call metadata
      const metadata = {
        scheduled_call_id: call.id,
        prospect_name: call.prospect_name,
        client_id: call.client_id,
        ...(call.call_metadata || {}),
      };

      // Create the Retell call
      const callResult = await createRetellCall({
        agentId: call.retell_agent_id,
        fromNumber: call.from_phone_number,
        toNumber: call.prospect_phone,
        metadata,
        apiKey: RETELL_API_KEY,
      });

      const callId = callResult?.call_id || callResult?.id;

      // Update with success
      await supabaseAdmin
        .from('retell_scheduled_calls')
        .update({
          status: 'completed',
          retell_call_id: callId,
        })
        .eq('id', call.id);

      console.log('[process-scheduled-calls] Call initiated successfully', {
        scheduled_call_id: call.id,
        retell_call_id: callId,
      });

      results.push({
        scheduled_call_id: call.id,
        success: true,
        retell_call_id: callId,
      });
    } catch (err: any) {
      console.error('[process-scheduled-calls] Failed to process call', {
        scheduled_call_id: call.id,
        error: err.message,
      });

      // Update with failure
      await supabaseAdmin
        .from('retell_scheduled_calls')
        .update({
          status: 'failed',
          error_message: err.message,
          retry_count: (call.retry_count || 0) + 1,
          last_retry_at: now.toISOString(),
        })
        .eq('id', call.id);

      results.push({
        scheduled_call_id: call.id,
        success: false,
        error: err.message,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log('[process-scheduled-calls] Batch complete', {
    total: results.length,
    success: successCount,
    failed: failureCount,
  });

  return {
    processed: results.length,
    success: successCount,
    failed: failureCount,
    results,
  };
}

async function createRetellCall(params: {
  agentId: string;
  fromNumber: string;
  toNumber: string;
  metadata: any;
  apiKey: string;
}) {
  const { agentId, fromNumber, toNumber, metadata, apiKey } = params;

  // Try v2 endpoint first, then fallback to v1
  const urls = [
    'https://api.retellai.com/v2/create-phone-call',
    'https://api.retellai.com/create-phone-call',
  ];

  let lastError: string | null = null;

  for (const url of urls) {
    try {
      const payload = {
        agent_id: agentId,
        from_number: fromNumber,
        to_number: toNumber,
        metadata,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (res.ok) {
        return json;
      }

      lastError = json?.error?.message || json?.message || json?.detail || text || `HTTP ${res.status}`;

      if (res.status === 401 || res.status === 403) {
        throw new Error('Retell API unauthorized');
      }
    } catch (err: any) {
      lastError = err.message;
    }
  }

  throw new Error(lastError || 'Failed to create Retell call');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[process-scheduled-calls] Cron job triggered');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const result = await processScheduledCalls(supabaseAdmin);

    return jsonRes({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    const message = error?.message || 'Cron job failed';
    console.error('[process-scheduled-calls] Error', { message });
    return jsonRes({ error: message, timestamp: new Date().toISOString() }, 500);
  }
});
