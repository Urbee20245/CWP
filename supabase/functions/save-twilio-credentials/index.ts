import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { encryptSecret } from '../_shared/encryption.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Get authorization header
  const authHeader = req.headers.get('Authorization');
  console.log('[save-twilio-credentials] Auth header present:', !!authHeader);

  if (!authHeader) {
    console.error('[save-twilio-credentials] Missing Authorization header');
    return errorResponse('Unauthorized: Missing authorization token.', 401);
  }

  // Initialize Supabase client with RLS checks (public client)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  
  // Initialize Supabase Admin client for privileged updates
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { client_id, account_sid, auth_token, phone_number } = await req.json();

    if (!client_id || !account_sid || !auth_token || !phone_number) {
      return errorResponse('Missing required fields.', 400);
    }
    
    // 1. Verify user identity and ownership (using RLS/Auth context)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse('Unauthorized: User not authenticated.', 401);
    }
    
    // Use RLS to ensure the user owns the client record
    const { error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('owner_profile_id', user.id)
        .single();
        
    if (clientError) {
        return errorResponse('Client record not found or unauthorized.', 403);
    }

    console.log(`[save-twilio-credentials] Encrypting and saving credentials for client ${client_id}`);

    // 2. Encrypt sensitive data
    let accountSidEncrypted, authTokenEncrypted;
    try {
        accountSidEncrypted = await encryptSecret(account_sid);
        authTokenEncrypted = await encryptSecret(auth_token);
        console.log('[save-twilio-credentials] Encryption successful');
    } catch (encryptError: any) {
        console.error('[save-twilio-credentials] Encryption failed:', encryptError);
        return errorResponse(`Encryption failed: ${encryptError.message}`, 500);
    }

    // 3. Upsert (Insert or Update) the record using the Admin client
    console.log('[save-twilio-credentials] Attempting to upsert into client_integrations...');
    const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from('client_integrations')
        .upsert({
            client_id: client_id,
            provider: 'twilio',
            account_sid_encrypted: accountSidEncrypted,
            auth_token_encrypted: authTokenEncrypted,
            phone_number: phone_number,
        }, { onConflict: 'client_id,provider' })
        .select();

    if (upsertError) {
        console.error('[save-twilio-credentials] Upsert failed:', upsertError);
        return errorResponse(`Failed to save credentials: ${upsertError.message}`, 500);
    }

    console.log('[save-twilio-credentials] Credentials saved successfully:', upsertData);
    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[save-twilio-credentials] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});