import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

/**
 * Retell AI Webhook Receiver
 *
 * Receives call lifecycle events from Retell AI:
 * - call_started: When a call begins
 * - call_ended: When a call ends (includes transcript, duration, recording)
 * - call_analyzed: Post-call analysis results
 *
 * All events are logged to webhook_events for audit trail.
 */
serve(async (req) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const startTime = Date.now();

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        const body = await req.json();
        const eventType = body.event || body.event_type || 'unknown';
        const callId = body.call_id || body.call?.call_id || null;

        console.log(`[retell-webhook] Received event: ${eventType}, call_id: ${callId}`);

        // Resolve client_id from the retell_agent_id in the call data
        const agentId = body.agent_id || body.call?.agent_id || null;
        let clientId: string | null = null;

        if (agentId) {
            const { data: voiceData } = await supabaseAdmin
                .from('client_voice_integrations')
                .select('client_id')
                .eq('retell_agent_id', agentId)
                .maybeSingle();

            clientId = voiceData?.client_id || null;
        }

        // Log the webhook event
        const { error: logError } = await supabaseAdmin
            .from('webhook_events')
            .insert({
                client_id: clientId,
                event_type: `retell.${eventType}`,
                event_source: 'retell',
                external_id: callId,
                request_payload: body,
                status: 'processing',
                ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
            });

        if (logError) {
            console.error('[retell-webhook] Failed to log event:', logError);
        }

        // Handle specific event types
        let responsePayload: Record<string, any> = { received: true };

        switch (eventType) {
            case 'call_started': {
                console.log(`[retell-webhook] Call started for client ${clientId}, call_id: ${callId}`);
                // Nothing to do yet — call is in progress
                break;
            }

            case 'call_ended': {
                console.log(`[retell-webhook] Call ended for client ${clientId}, call_id: ${callId}`);

                // Store call metadata if we have a client
                if (clientId && callId) {
                    const transcript = body.transcript || body.call?.transcript || null;
                    const callDuration = body.duration_ms || body.call?.duration_ms || null;
                    const recordingUrl = body.recording_url || body.call?.recording_url || null;
                    const disconnectReason = body.disconnect_reason || body.call?.disconnect_reason || null;

                    // Update the webhook event with response data
                    await supabaseAdmin
                        .from('webhook_events')
                        .update({
                            response_payload: {
                                transcript_length: transcript?.length || 0,
                                duration_ms: callDuration,
                                has_recording: !!recordingUrl,
                                disconnect_reason: disconnectReason,
                            },
                            status: 'completed',
                            duration_ms: Date.now() - startTime,
                        })
                        .eq('external_id', callId)
                        .eq('event_type', 'retell.call_ended');
                }
                break;
            }

            case 'call_analyzed': {
                console.log(`[retell-webhook] Call analyzed for client ${clientId}, call_id: ${callId}`);

                if (clientId && callId) {
                    await supabaseAdmin
                        .from('webhook_events')
                        .update({
                            response_payload: body.analysis || body.call_analysis || {},
                            status: 'completed',
                            duration_ms: Date.now() - startTime,
                        })
                        .eq('external_id', callId)
                        .eq('event_type', `retell.${eventType}`);
                }
                break;
            }

            default: {
                console.log(`[retell-webhook] Unhandled event type: ${eventType}`);
            }
        }

        // Mark event as completed
        if (callId) {
            await supabaseAdmin
                .from('webhook_events')
                .update({
                    status: 'completed',
                    duration_ms: Date.now() - startTime,
                })
                .eq('external_id', callId)
                .eq('event_type', `retell.${eventType}`)
                .eq('status', 'processing');
        }

        return jsonResponse(responsePayload);

    } catch (error: any) {
        console.error(`[retell-webhook] Error: ${error.message}`);

        // Try to log the failure
        try {
            await supabaseAdmin
                .from('webhook_events')
                .insert({
                    event_type: 'retell.error',
                    event_source: 'retell',
                    status: 'failed',
                    error_message: error.message,
                    duration_ms: Date.now() - startTime,
                });
        } catch (_) { /* best effort */ }

        return errorResponse(`Webhook processing error: ${error.message}`, 500);
    }
});
