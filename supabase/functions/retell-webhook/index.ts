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

        // Resolve client_id from the retell agent id
        const agentId = body.agent_id || body.call?.agent_id || body.retell_agent_id || null;
        let clientId: string | null = null;
        let resolutionError: string | null = null;

        if (agentId) {
            // 1) Prefer ai_agent_settings.retell_agent_id
            const { data: agentSettings, error: agentSettingsError } = await supabaseAdmin
                .from('ai_agent_settings')
                .select('client_id')
                .eq('retell_agent_id', agentId)
                .maybeSingle();

            if (agentSettingsError) {
                console.error('[retell-webhook] Failed to resolve via ai_agent_settings:', agentSettingsError);
            }

            clientId = agentSettings?.client_id || null;

            // 2) Fallback to client_voice_integrations.retell_agent_id
            if (!clientId) {
                const { data: voiceData, error: voiceError } = await supabaseAdmin
                    .from('client_voice_integrations')
                    .select('client_id')
                    .eq('retell_agent_id', agentId)
                    .maybeSingle();

                if (voiceError) {
                    console.error('[retell-webhook] Failed to resolve via client_voice_integrations:', voiceError);
                }

                clientId = voiceData?.client_id || null;
            }

            if (!clientId) {
                resolutionError = `Unable to resolve client_id for agent_id ${agentId}`;
            }
        } else {
            resolutionError = 'Missing agent_id in Retell webhook payload';
        }

        // Log the webhook event (best effort, always attempt)
        const { error: logError } = await supabaseAdmin
            .from('webhook_events')
            .insert({
                client_id: clientId,
                event_type: `retell.${eventType}`,
                event_source: 'retell',
                agent_id: agentId,
                retell_call_id: callId,
                external_id: callId,
                request_payload: body,
                response_payload: resolutionError ? { error: resolutionError } : {},
                status: resolutionError ? 'failed' : 'processing',
                duration_ms: Date.now() - startTime,
            });

        if (logError) {
            console.error('[retell-webhook] Failed to log event:', logError);
        }

        // Return 200 quickly even if we couldn't resolve client
        if (!clientId) {
            return jsonResponse({ received: true });
        }

        // Handle specific event types (lightweight only)
        let responsePayload: Record<string, any> = { received: true };

        switch (eventType) {
            case 'call_started': {
                console.log(`[retell-webhook] Call started for client ${clientId}, call_id: ${callId}`);
                break;
            }

            case 'call_ended': {
                console.log(`[retell-webhook] Call ended for client ${clientId}, call_id: ${callId}`);

                if (callId) {
                    const transcript = body.transcript || body.call?.transcript || null;
                    const callDuration = body.duration_ms || body.call?.duration_ms || null;
                    const recordingUrl = body.recording_url || body.call?.recording_url || null;
                    const disconnectReason = body.disconnect_reason || body.call?.disconnect_reason || null;

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
                        .eq('retell_call_id', callId)
                        .eq('event_type', 'retell.call_ended');
                }
                break;
            }

            case 'call_analyzed': {
                console.log(`[retell-webhook] Call analyzed for client ${clientId}, call_id: ${callId}`);

                if (callId) {
                    await supabaseAdmin
                        .from('webhook_events')
                        .update({
                            response_payload: body.analysis || body.call_analysis || {},
                            status: 'completed',
                            duration_ms: Date.now() - startTime,
                        })
                        .eq('retell_call_id', callId)
                        .eq('event_type', `retell.${eventType}`);
                }
                break;
            }

            default: {
                console.log(`[retell-webhook] Unhandled event type: ${eventType}`);
            }
        }

        // Mark event as completed if still processing
        if (callId) {
            await supabaseAdmin
                .from('webhook_events')
                .update({
                    status: 'completed',
                    duration_ms: Date.now() - startTime,
                })
                .eq('retell_call_id', callId)
                .eq('event_type', `retell.${eventType}`)
                .eq('status', 'processing');
        }

        return jsonResponse(responsePayload);

    } catch (error: any) {
        console.error(`[retell-webhook] Error: ${error.message}`);
        return errorResponse(`Webhook processing error: ${error.message}`, 500);
    }
});