import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Get authorization header
  const authHeader = req.headers.get('Authorization');
  console.log('[get-twilio-config] Auth header present:', !!authHeader);

  // Initialize Supabase client with RLS checks (public client)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader || '' } } }
  );

  // Initialize Supabase Admin client for privileged queries
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse('Client ID is required.', 400);
    }

    // Verify user identity and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[get-twilio-config] User auth result:', { user: !!user, error: authError });

    if (!user || authError) {
      console.error('[get-twilio-config] Auth failed:', authError);
      return errorResponse('Unauthorized: User not authenticated.', 401);
    }

    // Verify the user owns this client
    const { error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_profile_id', user.id)
        .single();

    if (clientError) {
        return errorResponse('Client record not found or unauthorized.', 403);
    }

    // Use admin client to fetch the config (bypassing RLS)
    const { data: config, error } = await supabaseAdmin
        .from('client_integrations')
        .select('account_sid_encrypted, phone_number, updated_at')
        .eq('client_id', client_id)
        .eq('provider', 'twilio')
        .maybeSingle();

    if (error) {
        console.error('[get-twilio-config] DB fetch error:', error);
        return errorResponse('Failed to fetch configuration.', 500);
    }
    
    if (!config) {
        return jsonResponse({ configured: false });
    }
    
    // Mask the SID (only show last 4 characters)
    const encryptedSid = config.account_sid_encrypted;
    const maskedSid = encryptedSid.substring(encryptedSid.length - 4);

    return jsonResponse({ 
        configured: true,
        phone_number: config.phone_number,
        masked_sid: maskedSid,
        updated_at: config.updated_at,
    });

  } catch (error: any) {
    console.error('[get-twilio-config] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});