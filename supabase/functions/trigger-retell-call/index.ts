// Edge Function: trigger-retell-call
// Purpose: Initiate a Retell AI phone call to a prospect
// Can be used for immediate calls or processing scheduled calls

export const config = {
  auth: false,
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

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Unauthorized');
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) throw new Error('Unauthorized');

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    console.error('[trigger-retell-call] auth.getUser failed', { message: userErr?.message });
    throw new Error('Unauthorized');
  }

  const userId = userData.user.id;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    console.error('[trigger-retell-call] profile lookup failed', { message: profileErr.message });
    throw new Error('Unauthorized');
  }

  if (profile?.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  return { supabaseAdmin, userId };
}

async function createRetellCall(params: {
  agentId: string;
  fromNumber: string;
  toNumber: string;
  metadata?: any;
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
        metadata: metadata || {},
      };

      console.log('[trigger-retell-call] Creating call', { url, payload: { ...payload, metadata: '...' } });

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
        console.log('[trigger-retell-call] Call created successfully', { callId: json?.call_id });
        return json;
      }

      lastError = json?.error?.message || json?.message || json?.detail || text || `HTTP ${res.status}`;
      console.error('[trigger-retell-call] Call creation failed', { url, error: lastError, status: res.status });

      // If unauthorized, don't try fallback
      if (res.status === 401 || res.status === 403) {
        throw new Error('Retell API unauthorized (check RETELL_API_KEY)');
      }
    } catch (err: any) {
      lastError = err.message;
      console.error('[trigger-retell-call] Exception during call creation', { url, error: err.message });
    }
  }

  throw new Error(lastError || 'Failed to create Retell call');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabaseAdmin, userId } = await requireAdmin(req);

    const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
    if (!RETELL_API_KEY) {
      console.error('[trigger-retell-call] Missing RETELL_API_KEY');
      return jsonRes({ error: 'RETELL_API_KEY is not configured in Supabase secrets.' }, 500);
    }

    const body = await req.json();
    const {
      scheduled_call_id, // If provided, this is processing a scheduled call
      client_id,
      prospect_name,
      prospect_phone,
      retell_agent_id,
      from_phone_number,
      scheduled_time, // For creating new scheduled call
      admin_notes,
      call_metadata,
      trigger_immediately = false, // If true, call immediately instead of scheduling
      connection_type,
      referrer_name,
      event_name,
      direct_context,
    } = body;

    // Validate required fields
    if (!client_id) return jsonRes({ error: 'Missing client_id' }, 400);
    if (!prospect_name) return jsonRes({ error: 'Missing prospect_name' }, 400);
    if (!prospect_phone) return jsonRes({ error: 'Missing prospect_phone' }, 400);
    if (!retell_agent_id) return jsonRes({ error: 'Missing retell_agent_id' }, 400);

    let scheduledCallRecord: any = null;

    // Case 1: Processing an existing scheduled call
    if (scheduled_call_id) {
      console.log('[trigger-retell-call] Processing scheduled call', { scheduled_call_id });

      // Fetch the scheduled call record
      const { data: existingCall, error: fetchErr } = await supabaseAdmin
        .from('retell_scheduled_calls')
        .select('*')
        .eq('id', scheduled_call_id)
        .maybeSingle();

      if (fetchErr || !existingCall) {
        console.error('[trigger-retell-call] Scheduled call not found', { scheduled_call_id, error: fetchErr });
        return jsonRes({ error: 'Scheduled call not found' }, 404);
      }

      if (existingCall.status === 'cancelled') {
        console.log('[trigger-retell-call] Scheduled call was cancelled', { scheduled_call_id });
        return jsonRes({ error: 'Scheduled call was cancelled' }, 400);
      }

      scheduledCallRecord = existingCall;

      // Update status to "calling"
      await supabaseAdmin
        .from('retell_scheduled_calls')
        .update({ status: 'calling', call_started_at: new Date().toISOString() })
        .eq('id', scheduled_call_id);
    }
    // Case 2: Creating a new call (immediate or scheduled)
    else {
      console.log('[trigger-retell-call] Creating new call', { trigger_immediately, scheduled_time });

      // Get from_phone_number if not provided
      let fromPhone = from_phone_number;
      if (!fromPhone) {
        const { data: voiceConfig } = await supabaseAdmin
          .from('client_voice_integrations')
          .select('phone_number')
          .eq('client_id', client_id)
          .maybeSingle();

        fromPhone = voiceConfig?.phone_number;
      }

      if (!fromPhone) {
        return jsonRes({ error: 'No phone number configured for this client. Please provision a voice number first.' }, 400);
      }

      // If not triggering immediately and scheduled_time is provided, create a scheduled call record
      if (!trigger_immediately && scheduled_time) {
        const { data: newScheduledCall, error: insertErr } = await supabaseAdmin
          .from('retell_scheduled_calls')
          .insert({
            client_id,
            created_by: userId,
            prospect_name,
            prospect_phone,
            scheduled_time,
            retell_agent_id,
            from_phone_number: fromPhone,
            status: 'pending',
            admin_notes,
            call_metadata: call_metadata || {},
            connection_type: connection_type || null,
            referrer_name: referrer_name || null,
            event_name: event_name || null,
            direct_context: direct_context || null,
          })
          .select()
          .single();

        if (insertErr) {
          console.error('[trigger-retell-call] Failed to create scheduled call', { error: insertErr });
          return jsonRes({ error: 'Failed to create scheduled call: ' + insertErr.message }, 500);
        }

        console.log('[trigger-retell-call] Scheduled call created', { id: newScheduledCall.id, scheduled_time });
        return jsonRes({
          success: true,
          scheduled_call_id: newScheduledCall.id,
          scheduled_time,
          message: 'Call scheduled successfully. It will be triggered at the specified time.',
        });
      }

      // If triggering immediately, create a scheduled call record with immediate status
      const { data: immediateCall, error: insertErr } = await supabaseAdmin
        .from('retell_scheduled_calls')
        .insert({
          client_id,
          created_by: userId,
          prospect_name,
          prospect_phone,
          scheduled_time: new Date().toISOString(), // Now
          retell_agent_id,
          from_phone_number: fromPhone,
          status: 'calling',
          call_started_at: new Date().toISOString(),
          admin_notes,
          call_metadata: call_metadata || {},
          connection_type: connection_type || null,
          referrer_name: referrer_name || null,
          event_name: event_name || null,
          direct_context: direct_context || null,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[trigger-retell-call] Failed to create immediate call record', { error: insertErr });
        return jsonRes({ error: 'Failed to create call record: ' + insertErr.message }, 500);
      }

      scheduledCallRecord = immediateCall;
    }

    // At this point, we should have scheduledCallRecord ready to call
    const fromPhone = scheduledCallRecord.from_phone_number;
    const toPhone = scheduledCallRecord.prospect_phone;
    const agentId = scheduledCallRecord.retell_agent_id;

    console.log('[trigger-retell-call] Initiating Retell call', {
      scheduledCallId: scheduledCallRecord.id,
      agentId,
      fromPhone,
      toPhone,
    });

    // Make the Retell API call
    try {
      const retellResponse = await createRetellCall({
        agentId,
        fromNumber: fromPhone,
        toNumber: toPhone,
        metadata: {
          scheduled_call_id: scheduledCallRecord.id,
          prospect_name: scheduledCallRecord.prospect_name,
          client_id: scheduledCallRecord.client_id,
          // Connection context variables for agent personalization
          connectionType: scheduledCallRecord.connection_type || 'direct',
          referrerName: scheduledCallRecord.referrer_name || '',
          eventName: scheduledCallRecord.event_name || '',
          directContext: scheduledCallRecord.direct_context || '',
          ...(scheduledCallRecord.call_metadata || {}),
        },
        apiKey: RETELL_API_KEY,
      });

      const callId = retellResponse?.call_id || retellResponse?.id;

      // Update the scheduled call record with success
      await supabaseAdmin
        .from('retell_scheduled_calls')
        .update({
          status: 'completed',
          retell_call_id: callId,
          call_ended_at: new Date().toISOString(),
        })
        .eq('id', scheduledCallRecord.id);

      console.log('[trigger-retell-call] Call initiated successfully', { callId });

      return jsonRes({
        success: true,
        scheduled_call_id: scheduledCallRecord.id,
        retell_call_id: callId,
        message: 'Call initiated successfully',
      });
    } catch (retellErr: any) {
      console.error('[trigger-retell-call] Retell API error', { error: retellErr.message });

      // Update the scheduled call record with failure
      await supabaseAdmin
        .from('retell_scheduled_calls')
        .update({
          status: 'failed',
          error_message: retellErr.message,
          retry_count: (scheduledCallRecord.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', scheduledCallRecord.id);

      return jsonRes({
        error: 'Failed to initiate call: ' + retellErr.message,
        scheduled_call_id: scheduledCallRecord.id,
      }, 500);
    }
  } catch (error: any) {
    const message = error?.message || 'Request failed';
    console.error('[trigger-retell-call] Error', { message });
    const status = message === 'Unauthorized' ? 401 : 500;
    return jsonRes({ error: message }, status);
  }
});
