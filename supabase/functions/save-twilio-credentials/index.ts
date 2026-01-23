import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { encryptSecret } from '../_shared/encryption.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with RLS checks (public client)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
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
    const accountSidEncrypted = await encryptSecret(account_sid);
    const authTokenEncrypted = await encryptSecret(auth_token);

    // 3. Upsert (Insert or Update) the record using the Admin client
    const { error: upsertError } = await supabaseAdmin
        .from('client_integrations')
        .upsert({
            client_id: client_id,
            provider: 'twilio',
            account_sid_encrypted: accountSidEncrypted,
            auth_token_encrypted: authTokenEncrypted,
            phone_number: phone_number,
        }, { onConflict: 'client_id, provider' });

    if (upsertError) {
        console.error('[save-twilio-credentials] Upsert failed:', upsertError);
        return errorResponse('Failed to save encrypted credentials.', 500);
    }
    
    console.log('[save-twilio-credentials] Credentials saved successfully.');
    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[save-twilio-credentials] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});