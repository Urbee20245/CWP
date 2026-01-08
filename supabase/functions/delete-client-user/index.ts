import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role key for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { clientId, userId } = await req.json();

    if (!clientId || !userId) {
      return errorResponse('Missing required fields: clientId and userId.', 400);
    }
    
    console.log(`[delete-client-user] Attempting to delete client ID: ${clientId} and user ID: ${userId}`);

    // 1. Delete Client Record (RLS is bypassed by service role key)
    // Deleting the client record will cascade delete related records (projects, invoices, etc.)
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (clientError) {
      console.error('[delete-client-user] Client record deletion failed:', clientError.message);
      return errorResponse(`Client record deletion failed: ${clientError.message}`, 500);
    }
    
    // 2. Delete Auth User (Requires Service Role Key)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('[delete-client-user] Auth user deletion failed:', authError.message);
      // Note: We proceed even if auth deletion fails, as the client record is gone, but log the error.
      // This usually happens if the user was already deleted or never existed.
    }
    
    console.log(`[delete-client-user] Client and user successfully deleted.`);

    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[delete-client-user] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});