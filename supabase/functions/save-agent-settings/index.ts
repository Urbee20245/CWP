export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

/**
 * Save AI Agent Settings
 * Upserts per-client agent configuration (system prompt, capabilities, business hours, etc.)
 */
serve(async (req) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        const body = await req.json();
        const { client_id, ...settings } = body;

        if (!client_id) {
            return errorResponse('Missing required field: client_id', 400);
        }

        console.log(`[save-agent-settings] Saving settings for client ${client_id}`);

        // Build the payload with only provided fields
        const payload: Record<string, any> = { client_id };

        // NOTE: Keep this list in sync with the actual ai_agent_settings table schema.
        const allowedFields = [
            'retell_agent_id',
            'agent_name', 'system_prompt', 'greeting_message',
            'can_check_availability', 'can_book_meetings', 'can_transfer_calls', 'can_send_sms',
            'default_meeting_duration', 'booking_buffer_minutes', 'max_advance_booking_days',
            'allowed_meeting_types', 'business_hours', 'timezone',
            'webhook_check_availability', 'webhook_book_meeting',
            'webhook_call_started', 'webhook_call_ended',
            'is_active',
        ];

        for (const field of allowedFields) {
            if (settings[field] !== undefined) {
                payload[field] = settings[field];
            }
        }

        const { data, error } = await supabaseAdmin
            .from('ai_agent_settings')
            .upsert(payload, { onConflict: 'client_id' })
            .select()
            .single();

        if (error) {
            console.error('[save-agent-settings] Upsert failed:', error);
            return errorResponse(`Failed to save settings: ${error.message}`, 500);
        }

        console.log('[save-agent-settings] Settings saved successfully.');

        // Auto-generate webhook URLs based on Supabase project URL
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const webhookBaseUrl = supabaseUrl ? `${supabaseUrl}/functions/v1` : null;

        return jsonResponse({
            success: true,
            settings: data,
            webhook_urls: webhookBaseUrl ? {
                retell_webhook: `${webhookBaseUrl}/retell-webhook`,
                check_availability: `${webhookBaseUrl}/check-availability`,
                book_meeting: `${webhookBaseUrl}/book-meeting`,
            } : null,
        });

    } catch (error: any) {
        console.error('[save-agent-settings] Error:', error.message);
        return errorResponse(error.message, 500);
    }
});