import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { encrypt } from '../_shared/encryption.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const settings = await req.json();

    if (!settings.from_name || !settings.from_email) {
      return errorResponse('Missing required Resend fields: From Name or From Email.', 400);
    }
    
    // Encrypt the API key if provided
    let encryptedApiKey = settings.api_key_encrypted;
    if (settings.api_key_encrypted && settings.api_key_encrypted.length < 100) {
      // If API key is short, it's probably plain text - encrypt it
      encryptedApiKey = encrypt(settings.api_key_encrypted);
    }
    
    if (!encryptedApiKey) {
        return errorResponse('API Key is required and must be provided.', 400);
    }

    const resendData = {
      id: settings.id || '00000000-0000-0000-0000-000000000000',
      api_key_encrypted: encryptedApiKey,
      from_name: settings.from_name,
      from_email: settings.from_email,
      is_active: settings.is_active !== undefined ? settings.is_active : false,
    };

    const { data, error } = await supabaseAdmin
      .from('resend_settings')
      .upsert(resendData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[save-resend-settings] Database error:', error);
      return errorResponse(error.message, 500);
    }

    console.log('[save-resend-settings] Settings saved successfully');
    return jsonResponse({ success: true, data });

  } catch (error: any) {
    console.error('[save-resend-settings] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});