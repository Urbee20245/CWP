import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import { sendAdminNotification } from '../_shared/adminNotificationService.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { subject, html_body } = await req.json();

    if (!subject || !html_body) {
      return errorResponse('Missing required fields: subject or html_body.', 400);
    }
    
    console.log(`[send-admin-notification] Received request for subject: ${subject}`);

    const result = await sendAdminNotification(supabaseAdmin, subject, html_body);

    if (result.success) {
        return jsonResponse({ success: true, messageId: result.messageId });
    } else {
        return errorResponse(result.error || 'Failed to send notification.', 500);
    }

  } catch (error: any) {
    console.error('[send-admin-notification] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});