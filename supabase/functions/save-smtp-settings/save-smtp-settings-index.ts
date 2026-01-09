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

    if (!settings.host || !settings.port || !settings.username || !settings.from_email) {
      return errorResponse('Missing required SMTP fields.', 400);
    }

    // Encrypt the password if provided
    let encryptedPassword = settings.password_encrypted;
    if (settings.password_encrypted && settings.password_encrypted.length < 100) {
      // If password is short, it's probably plain text - encrypt it
      encryptedPassword = encrypt(settings.password_encrypted);
    }

    const smtpData = {
      id: settings.id || '00000000-0000-0000-0000-000000000000',
      host: settings.host,
      port: settings.port,
      secure: settings.secure || false,
      username: settings.username,
      password_encrypted: encryptedPassword,
      from_name: settings.from_name,
      from_email: settings.from_email,
      is_active: settings.is_active !== undefined ? settings.is_active : true,
    };

    const { data, error } = await supabaseAdmin
      .from('smtp_settings')
      .upsert(smtpData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[save-smtp-settings] Database error:', error);
      return errorResponse(error.message, 500);
    }

    console.log('[save-smtp-settings] Settings saved successfully');
    return jsonResponse({ success: true, data });

  } catch (error: any) {
    console.error('[save-smtp-settings] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
