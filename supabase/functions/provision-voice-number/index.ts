import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Retell } from 'https://esm.sh/retell-sdk@0.1.1?target=deno';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { decryptSecret } from '../_shared/encryption.ts';

const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
// NOTE: This should be replaced with your actual Retell Agent ID, set as a secret or environment variable.
const RETELL_AGENT_ID = Deno.env.get('RETELL_AGENT_ID') || 'default-agent-id'; 

if (!RETELL_API_KEY) {
  console.error("[provision-voice-number] CRITICAL: RETELL_API_KEY missing.");
}

const retell = new Retell({ apiKey: RETELL_API_KEY });

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase Admin client for privileged DB access (fetching encrypted secrets)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse('Client ID is required.', 400);
    }
    
    if (!RETELL_API_KEY) {
        return errorResponse('Retell API is not configured.', 500);
    }

    console.log(`[provision-voice-number] Starting provisioning for client ${client_id}`);

    // 1. Fetch encrypted Twilio credentials
    const { data: config, error: configError } = await supabaseAdmin
        .from('client_integrations')
        .select('account_sid_encrypted, auth_token_encrypted, phone_number')
        .eq('client_id', client_id)
        .eq('provider', 'twilio')
        .maybeSingle();

    if (configError || !config || !config.account_sid_encrypted || !config.auth_token_encrypted || !config.phone_number) {
        return errorResponse('Twilio credentials not found or incomplete for this client.', 404);
    }
    
    // 2. Decrypt credentials
    const twilio_account_sid = await decryptSecret(config.account_sid_encrypted);
    const twilio_auth_token = await decryptSecret(config.auth_token_encrypted);
    const phone_number = config.phone_number;

    if (!twilio_account_sid || !twilio_auth_token || !phone_number) {
        return errorResponse('Decryption failed for Twilio credentials.', 500);
    }
    
    // 3. Check if already provisioned (Idempotency check)
    const { data: existingProvisioning } = await supabaseAdmin
        .from('client_voice_integrations')
        .select('retell_phone_id')
        .eq('client_id', client_id)
        .maybeSingle();
        
    if (existingProvisioning) {
        console.log(`[provision-voice-number] Already provisioned with Retell ID: ${existingProvisioning.retell_phone_id}. Returning success.`);
        return jsonResponse({ success: true, retell_phone_id: existingProvisioning.retell_phone_id, message: "Already provisioned." });
    }

    // 4. Call Retell API to Import Number
    let retellPhoneId: string;
    try {
        const retellResponse = await retell.phoneNumber.create({
            twilio_account_sid: twilio_account_sid,
            twilio_auth_token: twilio_auth_token,
            phone_number: phone_number,
            agent_id: RETELL_AGENT_ID, // Use the configured agent ID
        });
        
        retellPhoneId = retellResponse.phone_number_id;
        console.log(`[provision-voice-number] Retell import successful. ID: ${retellPhoneId}`);

    } catch (retellError: any) {
        console.error('[provision-voice-number] Retell API failed:', retellError.message);
        
        // Store failure result
        await supabaseAdmin
            .from('client_voice_integrations')
            .insert({
                client_id: client_id,
                voice_status: 'failed',
                retell_phone_id: 'RETELL_FAIL_' + Date.now(), // Store a unique failure marker
            });
            
        // Check for specific Twilio credential failure (Retell usually wraps this)
        if (retellError.message.includes('Twilio')) {
            return errorResponse('Retell failed: Invalid Twilio credentials or phone number not owned by account.', 400);
        }
        
        return errorResponse(`Retell provisioning failed: ${retellError.message}`, 500);
    }

    // 5. Store Provisioning Result (Success)
    const { data: insertData, error: insertError } = await supabaseAdmin
        .from('client_voice_integrations')
        .insert({
            client_id: client_id,
            retell_phone_id: retellPhoneId,
            voice_status: 'active',
        })
        .select()
        .single();

    if (insertError) {
        console.error('[provision-voice-number] DB insert failed:', insertError);
        // Note: Retell number is created, but DB failed to record. This requires manual cleanup/sync.
        return errorResponse('Provisioning succeeded but failed to record result in database.', 500);
    }

    return jsonResponse({ success: true, retell_phone_id: retellPhoneId });

  } catch (error: any) {
    console.error('[provision-voice-number] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});